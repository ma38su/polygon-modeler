import {
  AxesHelper,
  Color,
  DataTexture,
  DirectionalLight,
  Euler,
  EquirectangularReflectionMapping,
  GridHelper,
  HemisphereLight,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  OrthographicCamera,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  RGBAFormat,
  UnsignedByteType,
  WebGLRenderer,
  type Camera,
  Vector3,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { WebGPURenderer as WebGpuRenderer } from "three/webgpu";
import type {
  ModelObjectSnapshot,
  ObjectId,
  TransformValue,
  Vector3Value,
} from "../editor/document/types";
import { RenderGeometryAdapter } from "./adapters/RenderGeometryAdapter";
import { CpuPicker } from "./picking/CpuPicker";
import {
  RegionPicker,
  type RegionShape,
  type ScreenPoint,
} from "./picking/RegionPicker";
import type {
  SelectionItem,
  SelectionMode,
} from "../editor/selection/SelectionManager";
import { SELECTION_MODES } from "../editor/selection/SelectionManager";
import type { DisplayLayers } from "./displayLayers";
import { findScreenSnap } from "./snapping";
import {
  collectSnapCandidates,
  selectedVertexIndices,
  selectionFrameWorld,
  type TransformOrientation,
} from "./transform/elementSelection";
import {
  canUseWebGpu,
  getRendererPreference,
  type RendererBackend,
} from "./renderer/capabilities";

type Projection = "perspective" | "orthographic";

export interface ViewportStatus {
  backend?: RendererBackend;
  error?: string;
  projection: Projection;
}

type StatusListener = (status: ViewportStatus) => void;
type Renderer = WebGLRenderer | WebGpuRenderer;
export type TransformMode = "translate" | "rotate" | "scale";
export type NormalHandleOperation = "extrude" | "normalMove";
export type AxisConstraint = "all" | "x" | "y" | "z";
export interface SnapSettings {
  readonly grid: boolean;
  readonly vertex: boolean;
  readonly edge: boolean;
  readonly face: boolean;
  readonly gridSize: number;
}
export type EnvironmentPreset = "none" | "studio" | "sunset" | "night";
export interface LightingSettings {
  readonly environment: EnvironmentPreset;
  readonly environmentIntensity: number;
  readonly hemisphereIntensity: number;
  readonly keyLightIntensity: number;
  readonly keyLightColor: string;
}
export const DEFAULT_LIGHTING_SETTINGS: LightingSettings = {
  environment: "studio",
  environmentIntensity: 0.7,
  hemisphereIntensity: 1.2,
  keyLightIntensity: 2.2,
  keyLightColor: "#ffffff",
};
export type TransformCommitListener = (
  id: ObjectId,
  after: TransformValue,
) => void;
export interface ElementTransformUpdate {
  readonly objectId: ObjectId;
  readonly vertices: readonly {
    id: import("../editor/document/types").VertexId;
    position: Vector3Value;
  }[];
}
export type ElementTransformCommitListener = (
  mode: TransformMode,
  updates: readonly ElementTransformUpdate[],
) => void;
export type NormalHandleListener = (
  operation: NormalHandleOperation,
  distance: number,
  commit: boolean,
) => void;
export type KnifePoint = NonNullable<ReturnType<CpuPicker["pickKnifePoint"]>>;
export type KnifePointListener = (point: KnifePoint) => void;

export class Viewport {
  readonly element: HTMLElement;
  readonly #scene = new Scene();
  readonly #geometryAdapter = new RenderGeometryAdapter();
  readonly #picker = new CpuPicker();
  readonly #regionPicker = new RegionPicker();
  #knifePointListener?: KnifePointListener;
  readonly #elementPivot = new Object3D();
  readonly #normalPivot = new Object3D();
  readonly #hemisphereLight = new HemisphereLight(0xffffff, 0x28303d, 1.2);
  readonly #keyLight = new DirectionalLight(0xffffff, 2.2);
  readonly #perspectiveCamera = new PerspectiveCamera(45, 1, 0.01, 10_000);
  readonly #orthographicCamera = new OrthographicCamera(
    -5,
    5,
    5,
    -5,
    0.01,
    10_000,
  );
  readonly #statusListener: StatusListener;
  readonly #resizeObserver: ResizeObserver;
  #projection: Projection = "perspective";
  #renderer?: Renderer;
  #controls?: OrbitControls;
  #transformControls?: TransformControls;
  #transformMode: TransformMode = "translate";
  #transformEnabled = false;
  #axisConstraint: AxisConstraint = "all";
  #transformOrientation: TransformOrientation = "world";
  #snapSettings: SnapSettings = {
    grid: false,
    vertex: false,
    edge: false,
    face: false,
    gridSize: 0.5,
  };
  #transformInteractionBlocked = false;
  #fineTransform = false;
  #transformCommitListener?: TransformCommitListener;
  #elementTransformCommitListener?: ElementTransformCommitListener;
  #normalHandleListener?: NormalHandleListener;
  #normalOperation?: NormalHandleOperation;
  #normalOrigin?: Vector3;
  #normalDirection?: Vector3;
  #normalDragging = false;
  #selectedObjectId?: ObjectId;
  #transformBefore?: TransformValue;
  #objects: readonly ModelObjectSnapshot[] = [];
  #selectionModes: ReadonlySet<SelectionMode> = new Set(SELECTION_MODES);
  #selectionItems: readonly SelectionItem[] = [];
  readonly #elementPreview = new Map<
    ObjectId,
    { positions: Float32Array; indices: readonly number[] }
  >();
  #pickListener?: (item: SelectionItem | undefined, additive: boolean) => void;
  #pointerStart?: { x: number; y: number };
  #animationFrame?: number;
  #disposed = false;
  #environmentTexture?: DataTexture;
  #environmentPreset?: EnvironmentPreset;

  constructor(element: HTMLElement, statusListener: StatusListener) {
    this.element = element;
    this.#statusListener = statusListener;
    this.#scene.background = new Color(0x20252e);
    this.#scene.add(new GridHelper(20, 20, 0x586476, 0x343b47));
    this.#scene.add(new AxesHelper(2));
    this.#keyLight.position.set(5, 8, 6);
    this.#scene.add(this.#hemisphereLight, this.#keyLight);
    this.#scene.add(this.#geometryAdapter.group);
    this.#scene.add(this.#elementPivot);
    this.#scene.add(this.#normalPivot);
    this.setLighting(DEFAULT_LIGHTING_SETTINGS);
    this.#perspectiveCamera.position.set(6, 5, 8);
    this.#orthographicCamera.position.copy(this.#perspectiveCamera.position);

    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(element);
    window.addEventListener("keydown", this.#handleFineTransformKey);
    window.addEventListener("keyup", this.#handleFineTransformKey);
  }

  async initialize(): Promise<void> {
    const preference = getRendererPreference(window.location.search);
    try {
      if (preference !== "webgl2" && canUseWebGpu(navigator)) {
        await this.#initializeWebGpu();
      } else if (preference === "webgpu") {
        throw new Error("このブラウザではWebGPUを利用できません。");
      } else {
        this.#initializeWebGl2();
      }
    } catch (error) {
      if (preference === "webgpu") {
        this.#emitError(error);
        return;
      }
      this.#renderer?.dispose();
      try {
        this.#initializeWebGl2();
      } catch (fallbackError) {
        this.#emitError(fallbackError);
        return;
      }
    }

    if (this.#disposed) return;
    this.#initializeControls();
    this.#initializeTransformControls();
    this.#resize();
    this.#render();
  }

  setProjection(projection: Projection): void {
    if (projection === this.#projection) return;
    const previous = this.#camera;
    this.#projection = projection;
    this.#camera.position.copy(previous.position);
    this.#camera.quaternion.copy(previous.quaternion);
    this.#controls?.dispose();
    this.#removePointerListeners();
    this.#disposeTransformControls();
    this.#initializeControls();
    this.#initializeTransformControls();
    this.#attachSelectedObject();
    this.#resize();
    this.#emitStatus();
  }

  setLighting(settings: LightingSettings): void {
    this.#hemisphereLight.intensity = Math.max(0, settings.hemisphereIntensity);
    this.#keyLight.intensity = Math.max(0, settings.keyLightIntensity);
    this.#keyLight.color.set(settings.keyLightColor);
    if (this.#environmentPreset !== settings.environment) {
      this.#environmentTexture?.dispose();
      this.#environmentTexture = this.#createEnvironment(settings.environment);
      this.#environmentPreset = settings.environment;
      this.#scene.environment = this.#environmentTexture ?? null;
    }
    this.#scene.environmentIntensity = Math.max(
      0,
      settings.environmentIntensity,
    );
  }

  syncObjects(
    objects: readonly ModelObjectSnapshot[],
    selectedIds: ReadonlySet<ObjectId>,
    selectionModes: ReadonlySet<SelectionMode>,
    selectionItems: readonly SelectionItem[],
    displayLayers: DisplayLayers,
    geometryEpoch = 0,
  ): void {
    this.#geometryAdapter.sync(
      objects,
      selectedIds,
      selectionItems,
      displayLayers,
      geometryEpoch,
    );
    this.#objects = objects;
    this.#selectionModes = selectionModes;
    this.#selectionItems = selectionItems;
    this.#selectedObjectId = selectedIds.values().next().value;
    if (this.#normalDragging) return;
    this.#attachSelectedObject();
  }
  setPicking(
    modes: ReadonlySet<SelectionMode>,
    listener: (item: SelectionItem | undefined, additive: boolean) => void,
  ): void {
    this.#selectionModes = modes;
    this.#pickListener = listener;
  }
  setKnifePointListener(listener?: KnifePointListener): void {
    this.#knifePointListener = listener;
  }

  pickRegion(
    points: readonly ScreenPoint[],
    shape: RegionShape,
  ): SelectionItem[] {
    return this.#regionPicker.pick(
      points,
      shape,
      this.element.getBoundingClientRect(),
      this.#camera,
      this.#geometryAdapter,
      this.#objects,
      this.#selectionModes,
    );
  }

  setTransformMode(mode: TransformMode): void {
    this.#transformMode = mode;
    this.#transformEnabled = true;
    this.#transformControls?.setMode(mode);
    this.#attachSelectedObject();
  }

  setTransformEnabled(enabled: boolean): void {
    if (this.#transformEnabled === enabled) return;
    this.#transformEnabled = enabled;
    this.#attachSelectedObject();
  }

  setAxisConstraint(constraint: AxisConstraint): void {
    this.#axisConstraint = constraint;
    if (!this.#transformControls) return;
    this.#transformControls.showX = constraint === "all" || constraint === "x";
    this.#transformControls.showY = constraint === "all" || constraint === "y";
    this.#transformControls.showZ = constraint === "all" || constraint === "z";
  }
  setTransformOrientation(orientation: TransformOrientation): void {
    this.#transformOrientation = orientation;
    this.#attachSelectedObject();
  }

  setSnapSettings(settings: SnapSettings): void {
    this.#snapSettings = settings;
    this.#updateTransformSnapping();
  }

  setTransformInteractionBlocked(blocked: boolean): void {
    if (this.#transformInteractionBlocked === blocked) return;
    this.#transformInteractionBlocked = blocked;
    this.#attachSelectedObject();
  }

  setTransformCommitListener(listener: TransformCommitListener): void {
    this.#transformCommitListener = listener;
  }

  setElementTransformCommitListener(
    listener: ElementTransformCommitListener,
  ): void {
    this.#elementTransformCommitListener = listener;
  }

  setNormalHandleListener(listener: NormalHandleListener): void {
    this.#normalHandleListener = listener;
  }

  setNormalOperation(operation?: NormalHandleOperation): void {
    if (this.#normalOperation === operation) return;
    this.#normalOperation = operation;
    this.#normalDragging = false;
    this.#normalOrigin = undefined;
    this.#normalDirection = undefined;
    this.#attachSelectedObject();
  }

  dispose(): void {
    this.#disposed = true;
    this.#resizeObserver.disconnect();
    this.#controls?.dispose();
    this.#removePointerListeners();
    this.#disposeTransformControls();
    window.removeEventListener("keydown", this.#handleFineTransformKey);
    window.removeEventListener("keyup", this.#handleFineTransformKey);
    if (this.#animationFrame !== undefined) {
      cancelAnimationFrame(this.#animationFrame);
    }
    this.#renderer?.setAnimationLoop(null);
    this.#renderer?.dispose();
    this.#geometryAdapter.dispose();
    this.#environmentTexture?.dispose();
    this.element.replaceChildren();
  }

  get #camera(): Camera {
    return this.#projection === "perspective"
      ? this.#perspectiveCamera
      : this.#orthographicCamera;
  }

  #createEnvironment(preset: EnvironmentPreset): DataTexture | undefined {
    if (preset === "none") return undefined;
    const palettes: Record<Exclude<EnvironmentPreset, "none">, string[]> = {
      studio: ["#dce8ff", "#93a6c4", "#323a49", "#171b22"],
      sunset: ["#5e79ae", "#f2a56b", "#5d3545", "#17131d"],
      night: ["#15274b", "#26355d", "#11182b", "#070a12"],
    };
    const colors = palettes[preset].map((value) => new Color(value));
    const width = 16;
    const height = 8;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      const t = y / (height - 1);
      const scaled = t * (colors.length - 1);
      const index = Math.min(colors.length - 2, Math.floor(scaled));
      const color = colors[index]!.clone().lerp(
        colors[index + 1]!,
        scaled - index,
      );
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = Math.round(color.r * 255);
        data[offset + 1] = Math.round(color.g * 255);
        data[offset + 2] = Math.round(color.b * 255);
        data[offset + 3] = 255;
      }
    }
    const texture = new DataTexture(
      data,
      width,
      height,
      RGBAFormat,
      UnsignedByteType,
    );
    texture.mapping = EquirectangularReflectionMapping;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  async #initializeWebGpu(): Promise<void> {
    const { WebGPURenderer } = await import("three/webgpu");
    const renderer = new WebGPURenderer({ antialias: true });
    renderer.onDeviceLost = () => {
      this.#statusListener({
        projection: this.#projection,
        error: "GPUデバイスが失われました。再読み込みしてください。",
      });
    };
    await renderer.init();
    this.#renderer = renderer;
    this.element.replaceChildren(renderer.domElement);
    this.#emitStatus("webgpu");
  }

  #initializeWebGl2(): void {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", { antialias: true });
    if (!context) throw new Error("WebGL 2を初期化できませんでした。");
    const renderer = new WebGLRenderer({ canvas, context, antialias: true });
    this.#renderer = renderer;
    this.element.replaceChildren(canvas);
    canvas.addEventListener("webglcontextlost", this.#handleContextLost);
    this.#emitStatus("webgl2");
  }

  #initializeControls(): void {
    if (!this.#renderer) return;
    this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement);
    this.#controls.target.set(0, 0, 0);
    this.#controls.enableDamping = true;
    this.#controls.screenSpacePanning = true;
    this.#controls.update();
    this.#renderer.domElement.addEventListener(
      "pointerdown",
      this.#handlePointerDown,
    );
    this.#renderer.domElement.addEventListener(
      "pointerup",
      this.#handlePointerUp,
    );
  }
  #handlePointerDown = (event: PointerEvent): void => {
    this.#pointerStart = { x: event.clientX, y: event.clientY };
  };
  #removePointerListeners(): void {
    const canvas = this.#renderer?.domElement;
    canvas?.removeEventListener("pointerdown", this.#handlePointerDown);
    canvas?.removeEventListener("pointerup", this.#handlePointerUp);
  }
  #handlePointerUp = (event: PointerEvent): void => {
    const start = this.#pointerStart;
    this.#pointerStart = undefined;
    if (
      !start ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4 ||
      (!this.#pickListener && !this.#knifePointListener)
    )
      return;
    if (this.#knifePointListener) {
      const point = this.#picker.pickKnifePoint(
        event.clientX,
        event.clientY,
        this.element.getBoundingClientRect(),
        this.#camera,
        this.#geometryAdapter,
        this.#objects,
      );
      if (point) this.#knifePointListener(point);
      return;
    }
    const item = this.#picker.pickPrioritized(
      event.clientX,
      event.clientY,
      this.element.getBoundingClientRect(),
      this.#camera,
      this.#geometryAdapter,
      this.#objects,
      this.#selectionModes,
    );
    this.#pickListener?.(item, event.shiftKey);
  };

  #initializeTransformControls(): void {
    if (!this.#renderer) return;
    const controls = new TransformControls(
      this.#camera,
      this.#renderer.domElement,
    );
    controls.setMode(this.#transformMode);
    controls.setSize(0.8);
    controls.addEventListener("dragging-changed", (event) => {
      if (this.#controls) this.#controls.enabled = !event.value;
    });
    controls.addEventListener("mouseDown", this.#handleTransformStart);
    controls.addEventListener("objectChange", this.#handleTransformPreview);
    controls.addEventListener("mouseUp", this.#handleTransformEnd);
    this.#transformControls = controls;
    this.#updateTransformSnapping();
    this.setAxisConstraint(this.#axisConstraint);
    this.#scene.add(controls.getHelper());
  }

  #disposeTransformControls(): void {
    if (!this.#transformControls) return;
    this.#transformControls.detach();
    this.#scene.remove(this.#transformControls.getHelper());
    this.#transformControls.dispose();
    this.#transformControls = undefined;
  }

  #handleFineTransformKey = (event: KeyboardEvent): void => {
    if (event.key !== "Shift") return;
    const fine = event.type === "keydown";
    if (fine === this.#fineTransform) return;
    this.#fineTransform = fine;
    this.#updateTransformSnapping();
  };

  #updateTransformSnapping(): void {
    if (!this.#transformControls) return;
    this.#transformControls.setTranslationSnap(
      this.#fineTransform
        ? this.#snapSettings.grid
          ? this.#snapSettings.gridSize / 10
          : 0.05
        : this.#snapSettings.grid
          ? this.#snapSettings.gridSize
          : null,
    );
    this.#transformControls.setRotationSnap(
      this.#fineTransform ? Math.PI / 180 : null,
    );
    this.#transformControls.setScaleSnap(this.#fineTransform ? 0.01 : null);
  }

  #attachSelectedObject(): void {
    if (!this.#transformControls) return;
    if (
      this.#transformInteractionBlocked ||
      (!this.#transformEnabled && !this.#normalOperation)
    ) {
      this.#transformControls.detach();
      return;
    }
    if (this.#normalOperation && this.#selectionItems.length > 0) {
      const frame = selectionFrameWorld(
        this.#objects,
        this.#selectionItems,
        this.#geometryAdapter,
        "normal",
      );
      if (!frame) {
        this.#transformControls.detach();
        return;
      }
      this.#normalOrigin = frame.position.clone();
      this.#normalDirection = new Vector3(0, 0, 1)
        .applyQuaternion(frame.quaternion)
        .normalize();
      this.#normalPivot.position.copy(frame.position);
      this.#normalPivot.quaternion.copy(frame.quaternion);
      this.#normalPivot.scale.set(1, 1, 1);
      this.#transformControls.setMode("translate");
      this.#transformControls.setSpace("local");
      this.#transformControls.showX = false;
      this.#transformControls.showY = false;
      this.#transformControls.showZ = true;
      this.#transformControls.attach(this.#normalPivot);
      return;
    }
    this.#transformControls.setMode(this.#transformMode);
    this.setAxisConstraint(this.#axisConstraint);
    const mesh =
      this.#selectionItems.length === 0 && this.#selectedObjectId
        ? this.#geometryAdapter.getMesh(this.#selectedObjectId)
        : undefined;
    if (mesh) {
      this.#transformControls.setSpace("world");
      this.#transformControls.attach(mesh);
    } else if (this.#selectionItems.length > 0) {
      const frame = selectionFrameWorld(
        this.#objects,
        this.#selectionItems,
        this.#geometryAdapter,
        this.#transformOrientation,
      );
      if (!frame) this.#transformControls.detach();
      else {
        this.#elementPivot.position.copy(frame.position);
        this.#elementPivot.quaternion.copy(frame.quaternion);
        this.#elementPivot.scale.set(1, 1, 1);
        this.#transformControls.setSpace(
          this.#transformOrientation === "world" ? "world" : "local",
        );
        this.#transformControls.attach(this.#elementPivot);
      }
    } else this.#transformControls.detach();
  }

  #handleTransformStart = (): void => {
    if (this.#transformControls?.object === this.#normalPivot) {
      this.#normalDragging = true;
      return;
    }
    if (this.#transformControls?.object === this.#elementPivot) {
      this.#transformBefore = {
        position: {
          x: this.#elementPivot.position.x,
          y: this.#elementPivot.position.y,
          z: this.#elementPivot.position.z,
        },
        rotation: {
          x: this.#elementPivot.rotation.x,
          y: this.#elementPivot.rotation.y,
          z: this.#elementPivot.rotation.z,
        },
        scale: { x: 1, y: 1, z: 1 },
      };
      this.#captureElementPreview();
      return;
    }
    const mesh = this.#selectedObjectId
      ? this.#geometryAdapter.getMesh(this.#selectedObjectId)
      : undefined;
    if (mesh) this.#transformBefore = this.#readTransform(mesh);
  };

  #handleTransformEnd = (): void => {
    if (
      this.#transformControls?.object === this.#normalPivot &&
      this.#normalOperation
    ) {
      const distance = this.#normalHandleDistance();
      this.#normalDragging = false;
      this.#normalHandleListener?.(this.#normalOperation, distance, true);
      return;
    }
    if (
      this.#transformControls?.object === this.#elementPivot &&
      this.#transformBefore
    ) {
      const updates = this.#elementTransformUpdates();
      this.#restoreElementPreview();
      const before = this.#transformBefore.position;
      this.#elementPivot.position.set(before.x, before.y, before.z);
      const rotation = this.#transformBefore.rotation;
      this.#elementPivot.rotation.set(rotation.x, rotation.y, rotation.z);
      this.#elementPivot.scale.set(1, 1, 1);
      this.#transformBefore = undefined;
      if (updates.length)
        this.#elementTransformCommitListener?.(this.#transformMode, updates);
      return;
    }
    const id = this.#selectedObjectId;
    const mesh = id ? this.#geometryAdapter.getMesh(id) : undefined;
    if (id && mesh && this.#transformBefore) {
      this.#transformCommitListener?.(id, this.#readTransform(mesh));
    }
    this.#transformBefore = undefined;
  };

  #captureElementPreview(): void {
    this.#elementPreview.clear();
    for (const object of this.#objects) {
      const indices = [...selectedVertexIndices(object, this.#selectionItems)];
      if (indices.length === 0) continue;
      const mesh = this.#geometryAdapter.getMesh(object.id);
      const position = mesh?.geometry.getAttribute("position");
      if (position)
        this.#elementPreview.set(object.id, {
          positions: new Float32Array(position.array),
          indices,
        });
    }
  }

  #handleTransformPreview = (): void => {
    if (
      this.#transformControls?.object === this.#normalPivot &&
      this.#normalOperation
    ) {
      this.#normalHandleListener?.(
        this.#normalOperation,
        this.#normalHandleDistance(),
        false,
      );
      return;
    }
    if (
      this.#transformControls?.object !== this.#elementPivot ||
      !this.#transformBefore ||
      this.#elementPreview.size === 0
    )
      return;
    if (
      this.#transformMode === "translate" &&
      (this.#snapSettings.vertex ||
        this.#snapSettings.edge ||
        this.#snapSettings.face)
    )
      this.#snapElementPivot();
    const worldTransform = this.#elementWorldTransform();
    for (const object of this.#objects) {
      const preview = this.#elementPreview.get(object.id);
      const mesh = this.#geometryAdapter.getMesh(object.id);
      if (!preview || !mesh) continue;
      mesh.updateWorldMatrix(true, false);
      const worldToLocal = mesh.matrixWorld.clone().invert();
      const position = mesh.geometry.getAttribute("position");
      for (const index of preview.indices) {
        const transformed = new Vector3()
          .fromArray(preview.positions, index * 3)
          .applyMatrix4(mesh.matrixWorld)
          .applyMatrix4(worldTransform)
          .applyMatrix4(worldToLocal);
        position.setXYZ(index, transformed.x, transformed.y, transformed.z);
      }
      position.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
      this.#updatePreviewOverlays(object, preview, position.array);
    }
  };

  #normalHandleDistance(): number {
    if (!this.#normalOrigin || !this.#normalDirection) return 0;
    return this.#normalPivot.position
      .clone()
      .sub(this.#normalOrigin)
      .dot(this.#normalDirection);
  }

  #restoreElementPreview(): void {
    for (const [objectId, preview] of this.#elementPreview) {
      const mesh = this.#geometryAdapter.getMesh(objectId);
      if (!mesh) continue;
      const position = mesh.geometry.getAttribute("position");
      preview.positions.forEach(
        (value, index) => (position.array[index] = value),
      );
      position.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
      const object = this.#objects.find(
        (candidate) => candidate.id === objectId,
      );
      if (object)
        this.#updatePreviewOverlays(object, preview, preview.positions);
    }
    this.#elementPreview.clear();
  }

  #elementWorldTransform(): Matrix4 {
    const { position, rotation } = this.#transformBefore!;
    const initial = new Matrix4().compose(
      new Vector3(position.x, position.y, position.z),
      new Quaternion().setFromEuler(
        new Euler(rotation.x, rotation.y, rotation.z),
      ),
      new Vector3(1, 1, 1),
    );
    this.#elementPivot.updateMatrix();
    return this.#elementPivot.matrix.clone().multiply(initial.invert());
  }

  #snapElementPivot(): void {
    const candidates = collectSnapCandidates(
      this.#objects,
      this.#selectionItems,
      this.#geometryAdapter,
      this.#snapSettings,
    );
    const bounds = this.element.getBoundingClientRect();
    const snapped = findScreenSnap(
      this.#elementPivot.position,
      candidates,
      (point) => point.project(this.#camera),
      bounds,
      this.#axisConstraint,
      12,
    );
    if (snapped) this.#elementPivot.position.copy(snapped);
  }

  #elementTransformUpdates(): ElementTransformUpdate[] {
    const updates: ElementTransformUpdate[] = [];
    for (const object of this.#objects) {
      const preview = this.#elementPreview.get(object.id);
      const position = this.#geometryAdapter
        .getMesh(object.id)
        ?.geometry.getAttribute("position");
      if (!preview || !position) continue;
      const vertices = preview.indices.flatMap((index) => {
        const next = {
          x: position.getX(index),
          y: position.getY(index),
          z: position.getZ(index),
        };
        const offset = index * 3;
        const changed =
          Math.abs(next.x - preview.positions[offset]!) > Number.EPSILON ||
          Math.abs(next.y - preview.positions[offset + 1]!) > Number.EPSILON ||
          Math.abs(next.z - preview.positions[offset + 2]!) > Number.EPSILON;
        return changed
          ? [{ id: object.mesh.vertexIds[index]!, position: next }]
          : [];
      });
      if (vertices.length) updates.push({ objectId: object.id, vertices });
    }
    return updates;
  }

  #updatePreviewOverlays(
    object: ModelObjectSnapshot,
    preview: { positions: Float32Array; indices: readonly number[] },
    positions: ArrayLike<number>,
  ): void {
    const overlay = this.#geometryAdapter.getOverlay(object.id);
    if (!overlay) return;
    const selected = new Set(preview.indices);
    const vertices = overlay.getObjectByName("vertex-overlay");
    if (vertices instanceof InstancedMesh) {
      const matrix = new Matrix4();
      for (const index of preview.indices) {
        matrix.makeTranslation(
          positions[index * 3]!,
          positions[index * 3 + 1]!,
          positions[index * 3 + 2]!,
        );
        vertices.setMatrixAt(index, matrix);
      }
      vertices.instanceMatrix.needsUpdate = true;
    }
    const edges = overlay.getObjectByName("edge-overlay");
    if (edges instanceof LineSegments) {
      const position = edges.geometry.getAttribute("position");
      object.mesh.edges.forEach((edge, edgeIndex) => {
        edge.vertices.forEach((vertexIndex, endpointIndex) => {
          if (!selected.has(vertexIndex)) return;
          position.setXYZ(
            edgeIndex * 2 + endpointIndex,
            positions[vertexIndex * 3]!,
            positions[vertexIndex * 3 + 1]!,
            positions[vertexIndex * 3 + 2]!,
          );
        });
      });
      position.needsUpdate = true;
      edges.geometry.computeBoundingSphere();
    }
    const directlySelectedVertices = object.mesh.vertexIds.flatMap(
      (id, index) =>
        this.#selectionItems.some(
          (item) => item.objectId === object.id && item.elementId === id,
        )
          ? [index]
          : [],
    );
    const selectedVertices = overlay.getObjectByName(
      "vertex-selection-overlay",
    );
    if (selectedVertices instanceof InstancedMesh) {
      const matrix = new Matrix4();
      directlySelectedVertices.forEach((index, instanceIndex) => {
        matrix.makeTranslation(
          positions[index * 3]!,
          positions[index * 3 + 1]!,
          positions[index * 3 + 2]!,
        );
        selectedVertices.setMatrixAt(instanceIndex, matrix);
      });
      selectedVertices.instanceMatrix.needsUpdate = true;
    }
    const selectedFaces = overlay.getObjectByName("face-selection-overlay");
    if (selectedFaces instanceof Mesh) {
      const position = selectedFaces.geometry.getAttribute("position");
      for (let index = 0; index < position.count; index += 1)
        position.setXYZ(
          index,
          positions[index * 3]!,
          positions[index * 3 + 1]!,
          positions[index * 3 + 2]!,
        );
      position.needsUpdate = true;
      selectedFaces.geometry.computeBoundingSphere();
    }
  }

  #readTransform(mesh: import("three").Mesh): TransformValue {
    return {
      position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
      rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
      scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
    };
  }

  #resize(): void {
    if (!this.#renderer) return;
    const width = Math.max(1, this.element.clientWidth);
    const height = Math.max(1, this.element.clientHeight);
    const aspect = width / height;
    this.#perspectiveCamera.aspect = aspect;
    this.#perspectiveCamera.updateProjectionMatrix();
    const size = 5;
    this.#orthographicCamera.left = -size * aspect;
    this.#orthographicCamera.right = size * aspect;
    this.#orthographicCamera.top = size;
    this.#orthographicCamera.bottom = -size;
    this.#orthographicCamera.updateProjectionMatrix();
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.setSize(width, height, false);
  }

  #render = (): void => {
    if (this.#disposed || !this.#renderer) return;
    this.#controls?.update();
    this.#renderer.render(this.#scene, this.#camera);
    this.#animationFrame = requestAnimationFrame(this.#render);
  };

  #handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.#statusListener({
      projection: this.#projection,
      error: "GPUコンテキストが失われました。再読み込みしてください。",
    });
  };

  #emitStatus(backend?: RendererBackend): void {
    this.#statusListener({
      backend: backend ?? this.#rendererBackend,
      projection: this.#projection,
    });
  }

  #emitError(error: unknown): void {
    this.#statusListener({
      projection: this.#projection,
      error:
        error instanceof Error ? error.message : "描画の初期化に失敗しました。",
    });
  }

  get #rendererBackend(): RendererBackend | undefined {
    if (!this.#renderer) return undefined;
    return this.#renderer instanceof WebGLRenderer ? "webgl2" : "webgpu";
  }
}
