import {
  AxesHelper,
  Color,
  GridHelper,
  HemisphereLight,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Camera,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { WebGPURenderer as WebGpuRenderer } from "three/webgpu";
import type {
  ModelObjectSnapshot,
  ObjectId,
  TransformValue,
} from "../editor/document/types";
import { RenderGeometryAdapter } from "./adapters/RenderGeometryAdapter";
import { CpuPicker } from "./picking/CpuPicker";
import type {
  SelectionItem,
  SelectionMode,
} from "../editor/selection/SelectionManager";
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
export type TransformCommitListener = (
  id: ObjectId,
  before: TransformValue,
  after: TransformValue,
) => void;

export class Viewport {
  readonly element: HTMLElement;
  readonly #scene = new Scene();
  readonly #geometryAdapter = new RenderGeometryAdapter();
  readonly #picker = new CpuPicker();
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
  #transformCommitListener?: TransformCommitListener;
  #selectedObjectId?: ObjectId;
  #transformBefore?: TransformValue;
  #objects: readonly ModelObjectSnapshot[] = [];
  #selectionMode: SelectionMode = "object";
  #pickListener?: (item: SelectionItem | undefined, additive: boolean) => void;
  #pointerStart?: { x: number; y: number };
  #animationFrame?: number;
  #disposed = false;

  constructor(element: HTMLElement, statusListener: StatusListener) {
    this.element = element;
    this.#statusListener = statusListener;
    this.#scene.background = new Color(0x20252e);
    this.#scene.add(new GridHelper(20, 20, 0x586476, 0x343b47));
    this.#scene.add(new AxesHelper(2));
    this.#scene.add(new HemisphereLight(0xffffff, 0x28303d, 1.5));
    this.#scene.add(this.#geometryAdapter.group);
    this.#perspectiveCamera.position.set(6, 5, 8);
    this.#orthographicCamera.position.copy(this.#perspectiveCamera.position);

    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(element);
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

  syncObjects(
    objects: readonly ModelObjectSnapshot[],
    selectedIds: ReadonlySet<ObjectId>,
  ): void {
    this.#geometryAdapter.sync(objects, selectedIds);
    this.#objects = objects;
    this.#selectedObjectId = selectedIds.values().next().value;
    this.#attachSelectedObject();
  }
  setPicking(
    mode: SelectionMode,
    listener: (item: SelectionItem | undefined, additive: boolean) => void,
  ): void {
    this.#selectionMode = mode;
    this.#pickListener = listener;
  }

  setTransformMode(mode: TransformMode): void {
    this.#transformMode = mode;
    this.#transformControls?.setMode(mode);
  }

  setTransformCommitListener(listener: TransformCommitListener): void {
    this.#transformCommitListener = listener;
  }

  dispose(): void {
    this.#disposed = true;
    this.#resizeObserver.disconnect();
    this.#controls?.dispose();
    this.#removePointerListeners();
    this.#disposeTransformControls();
    if (this.#animationFrame !== undefined) {
      cancelAnimationFrame(this.#animationFrame);
    }
    this.#renderer?.setAnimationLoop(null);
    this.#renderer?.dispose();
    this.#geometryAdapter.dispose();
    this.element.replaceChildren();
  }

  get #camera(): Camera {
    return this.#projection === "perspective"
      ? this.#perspectiveCamera
      : this.#orthographicCamera;
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
      !this.#pickListener
    )
      return;
    const item = this.#picker.pick(
      event.clientX,
      event.clientY,
      this.element.getBoundingClientRect(),
      this.#camera,
      this.#geometryAdapter,
      this.#objects,
      this.#selectionMode,
    );
    this.#pickListener(item, event.shiftKey);
  };

  #initializeTransformControls(): void {
    if (!this.#renderer) return;
    const controls = new TransformControls(
      this.#camera,
      this.#renderer.domElement,
    );
    controls.setMode(this.#transformMode);
    controls.addEventListener("dragging-changed", (event) => {
      if (this.#controls) this.#controls.enabled = !event.value;
    });
    controls.addEventListener("mouseDown", this.#handleTransformStart);
    controls.addEventListener("mouseUp", this.#handleTransformEnd);
    this.#transformControls = controls;
    this.#scene.add(controls.getHelper());
  }

  #disposeTransformControls(): void {
    if (!this.#transformControls) return;
    this.#transformControls.detach();
    this.#scene.remove(this.#transformControls.getHelper());
    this.#transformControls.dispose();
    this.#transformControls = undefined;
  }

  #attachSelectedObject(): void {
    if (!this.#transformControls) return;
    const mesh = this.#selectedObjectId
      ? this.#geometryAdapter.getMesh(this.#selectedObjectId)
      : undefined;
    if (mesh) this.#transformControls.attach(mesh);
    else this.#transformControls.detach();
  }

  #handleTransformStart = (): void => {
    const mesh = this.#selectedObjectId
      ? this.#geometryAdapter.getMesh(this.#selectedObjectId)
      : undefined;
    if (mesh) this.#transformBefore = this.#readTransform(mesh);
  };

  #handleTransformEnd = (): void => {
    const id = this.#selectedObjectId;
    const mesh = id ? this.#geometryAdapter.getMesh(id) : undefined;
    if (id && mesh && this.#transformBefore) {
      this.#transformCommitListener?.(
        id,
        this.#transformBefore,
        this.#readTransform(mesh),
      );
    }
    this.#transformBefore = undefined;
  };

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
