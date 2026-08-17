import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  SphereGeometry,
  TextureLoader,
} from "three";
import type {
  ModelObjectSnapshot,
  ObjectId,
} from "../../editor/document/types";
import { triangulate } from "../../editor/mesh/triangulate";
import { collectFaceNormalSegments } from "../../editor/mesh/meshDiagnostics";
import type { SelectionItem } from "../../editor/selection/SelectionManager";
import { DEFAULT_DISPLAY_LAYERS, type DisplayLayers } from "../displayLayers";

const OVERLAY_NAME = "selection-overlay";
const baseColor = new Color(0x6f7d91);
const vertexColor = new Color(0xd7e2f2);
const selectedColor = new Color(0x55d98b);
const hoverColor = new Color(0xffc857);
const VERTEX_RADIUS = 0.025;
type SurfaceMaterial =
  | MeshBasicMaterial
  | MeshLambertMaterial
  | MeshPhongMaterial
  | MeshStandardMaterial;

export class RenderGeometryAdapter {
  readonly group = new Group();
  readonly #meshes = new Map<ObjectId, Mesh>();
  readonly #meshRevisions = new Map<ObjectId, string>();
  readonly #materialRevisions = new Map<ObjectId, string>();
  readonly #overlayRevisions = new Map<
    ObjectId,
    { geometry: string; selection: string; display: string }
  >();
  #hoverItem?: SelectionItem;
  sync(
    objects: readonly ModelObjectSnapshot[],
    selectedIds: ReadonlySet<ObjectId>,
    selectionItems: readonly SelectionItem[] = [],
    displayLayers: DisplayLayers = DEFAULT_DISPLAY_LAYERS,
    geometryEpoch = 0,
  ): void {
    const liveIds = new Set(objects.map((object) => object.id));
    for (const [id, mesh] of this.#meshes)
      if (!liveIds.has(id)) this.#remove(id, mesh);
    for (const object of objects) {
      const renderObject = object.evaluatedMesh
        ? { ...object, mesh: object.evaluatedMesh }
        : object;
      const geometryRevision = `${geometryEpoch}:${object.mesh.revision}:${JSON.stringify(object.modifiers ?? [])}`;
      let mesh = this.#meshes.get(object.id);
      if (!mesh) {
        mesh = this.#createMesh(renderObject);
        this.#meshes.set(object.id, mesh);
        this.group.add(mesh);
        this.#meshRevisions.set(object.id, geometryRevision);
        this.#materialRevisions.set(object.id, JSON.stringify(object.material));
      } else if (this.#meshRevisions.get(object.id) !== geometryRevision) {
        if (this.#hoverItem?.objectId === object.id) this.setHover(undefined);
        mesh.geometry.dispose();
        mesh.geometry = this.#createGeometry(renderObject);
        this.#meshRevisions.set(object.id, geometryRevision);
      }
      const materialRevision = JSON.stringify(object.material);
      if (this.#materialRevisions.get(object.id) !== materialRevision) {
        this.#disposeMaterial(mesh.material as SurfaceMaterial);
        mesh.material = this.#createMaterial(object);
        this.#materialRevisions.set(object.id, materialRevision);
      }
      mesh.name = object.name;
      mesh.userData.modelSnapshot = object;
      mesh.visible = object.visible;
      mesh.position.set(
        object.transform.position.x,
        object.transform.position.y,
        object.transform.position.z,
      );
      mesh.rotation.set(
        object.transform.rotation.x,
        object.transform.rotation.y,
        object.transform.rotation.z,
      );
      mesh.scale.set(
        object.transform.scale.x,
        object.transform.scale.y,
        object.transform.scale.z,
      );
      const material = mesh.material as SurfaceMaterial;
      const objectSelected =
        selectionItems.length === 0 && selectedIds.has(object.id);
      material.color
        .set(object.material.color)
        .lerp(new Color(0x78a0ff), objectSelected ? 0.45 : 0);
      material.transparent = !displayLayers.faces;
      material.opacity = displayLayers.faces ? 1 : 0;
      material.depthWrite = displayLayers.faces;
      material.colorWrite = displayLayers.faces;
      mesh.userData.modelSnapshot = renderObject;
      this.#syncOverlay(
        mesh,
        renderObject,
        selectionItems,
        displayLayers,
        geometryRevision,
      );
    }
  }
  dispose(): void {
    for (const [id, mesh] of this.#meshes) this.#remove(id, mesh);
  }

  getMesh(id: ObjectId): Mesh | undefined {
    return this.#meshes.get(id);
  }
  getObjectId(mesh: Mesh): ObjectId | undefined {
    for (const [id, candidate] of this.#meshes)
      if (candidate === mesh) return id;
    return undefined;
  }
  getOverlay(id: ObjectId): Group | undefined {
    return this.#meshes.get(id)?.getObjectByName(OVERLAY_NAME) as
      Group | undefined;
  }
  setHover(item?: SelectionItem): void {
    if (
      item?.objectId === this.#hoverItem?.objectId &&
      item?.elementId === this.#hoverItem?.elementId
    )
      return;
    if (this.#hoverItem) {
      const previous = this.#meshes
        .get(this.#hoverItem.objectId)
        ?.getObjectByName("hover-overlay");
      if (previous) {
        previous.parent?.remove(previous);
        this.#disposeObject(previous);
      }
    }
    this.#hoverItem = item;
    if (!item) return;
    const mesh = this.#meshes.get(item.objectId);
    if (!mesh) return;
    // Snapshot data is retained on the render mesh so hover updates remain
    // independent from React/scene synchronization.
    const snapshot = mesh.userData.modelSnapshot as
      ModelObjectSnapshot | undefined;
    if (!snapshot) return;
    const overlay = new Group();
    overlay.name = "hover-overlay";
    overlay.renderOrder = 7;
    const vertexIndex = snapshot.mesh.vertexIds.indexOf(
      item.elementId as (typeof snapshot.mesh.vertexIds)[number],
    );
    if (vertexIndex >= 0) {
      const marker = this.#createVertexMarkers(
        snapshot,
        [vertexIndex],
        VERTEX_RADIUS,
        hoverColor,
      );
      marker.renderOrder = 7;
      overlay.add(marker);
    } else {
      const edge = snapshot.mesh.edges.find(
        (candidate) => candidate.id === item.elementId,
      );
      if (edge) this.#addHoverEdge(overlay, snapshot, edge.vertices);
      else {
        const faceIndex = snapshot.mesh.faceIds.indexOf(
          item.elementId as (typeof snapshot.mesh.faceIds)[number],
        );
        if (faceIndex >= 0) this.#addHoverFace(overlay, snapshot, faceIndex);
      }
    }
    if (overlay.children.length) mesh.add(overlay);
  }
  #createMesh(object: ModelObjectSnapshot): Mesh {
    const mesh = new Mesh(
      this.#createGeometry(object),
      this.#createMaterial(object),
    );
    mesh.userData.modelSnapshot = object;
    return mesh;
  }

  #createMaterial(object: ModelObjectSnapshot): SurfaceMaterial {
    const load = (source?: string, srgb = false) => {
      if (!source) return undefined;
      const texture = new TextureLoader().load(source);
      if (srgb) texture.colorSpace = SRGBColorSpace;
      return texture;
    };
    const textures = object.material.textures;
    const common = { color: object.material.color, side: DoubleSide };
    let material: SurfaceMaterial;
    if (object.material.shading === "basic")
      material = new MeshBasicMaterial(common);
    else if (object.material.shading === "lambert")
      material = new MeshLambertMaterial(common);
    else if (object.material.shading === "phong")
      material = new MeshPhongMaterial({ ...common, shininess: 48 });
    else
      material = new MeshStandardMaterial({
        ...common,
        roughness: object.material.roughness,
        metalness: object.material.metalness,
      });
    material.map = load(textures?.baseColor?.source, true) ?? null;
    if (!(material instanceof MeshStandardMaterial)) return material;
    material.normalMap = load(textures?.normal?.source) ?? null;
    material.roughnessMap = load(textures?.roughness?.source) ?? null;
    material.metalnessMap = load(textures?.metalness?.source) ?? null;
    return material;
  }

  #createGeometry(object: ModelObjectSnapshot): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(object.mesh.positions, 3),
    );
    geometry.setIndex(triangulate(object.mesh));
    if (object.mesh.faceUvs?.some((face) => face.some(Boolean))) {
      const uv = new Float32Array(object.mesh.vertexIds.length * 2);
      object.mesh.faces.forEach((face, faceIndex) =>
        face.forEach((vertexIndex, corner) => {
          const value = object.mesh.faceUvs?.[faceIndex]?.[corner];
          if (value) {
            uv[vertexIndex * 2] = value.u;
            uv[vertexIndex * 2 + 1] = value.v;
          }
        }),
      );
      geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  #syncOverlay(
    mesh: Mesh,
    object: ModelObjectSnapshot,
    items: readonly SelectionItem[],
    displayLayers: DisplayLayers,
    geometryRevision: string,
  ): void {
    const selected = new Set(
      items
        .filter((item) => item.objectId === object.id)
        .map((item) => item.elementId),
    );
    const selectionRevision = [...selected].sort().join("\u0000");
    const displayRevision = `${displayLayers.vertices ? 1 : 0}${displayLayers.edges ? 1 : 0}${displayLayers.faces ? 1 : 0}${displayLayers.normals ? 1 : 0}`;
    const previousRevision = this.#overlayRevisions.get(object.id);
    if (
      previousRevision?.geometry === geometryRevision &&
      previousRevision.selection === selectionRevision &&
      previousRevision.display === displayRevision
    )
      return;

    let overlay = mesh.getObjectByName(OVERLAY_NAME) as Group | undefined;
    if (!overlay) {
      overlay = new Group();
      overlay.name = OVERLAY_NAME;
      overlay.renderOrder = 4;
      mesh.add(overlay);
    }
    const geometryChanged = previousRevision?.geometry !== geometryRevision;
    const selectionChanged = previousRevision?.selection !== selectionRevision;
    const displayChanged = previousRevision?.display !== displayRevision;
    if (geometryChanged || displayChanged) {
      this.#syncLayer(overlay, "vertex-overlay", displayLayers.vertices, () =>
        this.#addVertexOverlay(overlay!, object, selected, false),
      );
      this.#syncLayer(overlay, "edge-overlay", displayLayers.edges, () =>
        this.#addEdgeOverlay(overlay!, object, selected, true),
      );
      this.#syncLayer(overlay, "normal-overlay", !!displayLayers.normals, () =>
        this.#addNormalOverlay(overlay!, object),
      );
    } else if (selectionChanged && displayLayers.edges) {
      this.#updateEdgeSelection(overlay, object, selected);
    }
    if (geometryChanged || selectionChanged || displayChanged) {
      this.#removeLayer(overlay, "vertex-selection-overlay");
      if (displayLayers.vertices)
        this.#addSelectedVertexOverlay(overlay, object, selected);
      this.#removeLayer(overlay, "face-selection-overlay");
      if (displayLayers.faces) this.#addFaceOverlay(overlay, object, selected);
    }
    if (overlay.children.length === 0) mesh.remove(overlay);
    this.#overlayRevisions.set(object.id, {
      geometry: geometryRevision,
      selection: selectionRevision,
      display: displayRevision,
    });
  }
  #syncLayer(
    overlay: Group,
    name: string,
    visible: boolean,
    create: () => void,
  ): void {
    this.#removeLayer(overlay, name);
    if (visible) create();
  }
  #removeLayer(overlay: Group, name: string): void {
    const layer = overlay.getObjectByName(name);
    if (!layer) return;
    overlay.remove(layer);
    this.#disposeObject(layer);
  }
  #addVertexOverlay(
    overlay: Group,
    object: ModelObjectSnapshot,
    selected: ReadonlySet<SelectionItem["elementId"]>,
    highlightSelection: boolean,
  ): void {
    const vertices = this.#createVertexMarkers(
      object,
      object.mesh.vertexIds.map((_, index) => index),
      VERTEX_RADIUS,
      vertexColor,
    );
    vertices.name = "vertex-overlay";
    overlay.add(vertices);
    if (highlightSelection)
      this.#addSelectedVertexOverlay(overlay, object, selected);
  }
  #addSelectedVertexOverlay(
    overlay: Group,
    object: ModelObjectSnapshot,
    selected: ReadonlySet<SelectionItem["elementId"]>,
  ): void {
    if (selected.size === 0) return;
    const selectedIndices = object.mesh.vertexIds.flatMap((id, index) =>
      selected.has(id) ? [index] : [],
    );
    if (selectedIndices.length === 0) return;
    const selectedVertices = this.#createVertexMarkers(
      object,
      selectedIndices,
      VERTEX_RADIUS,
      selectedColor,
    );
    selectedVertices.name = "vertex-selection-overlay";
    selectedVertices.renderOrder = 5;
    overlay.add(selectedVertices);
  }
  #createVertexMarkers(
    object: ModelObjectSnapshot,
    vertexIndices: readonly number[],
    radius: number,
    color: Color,
  ): InstancedMesh {
    const markers = new InstancedMesh(
      new SphereGeometry(radius, 10, 8),
      new MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
      }),
      vertexIndices.length,
    );
    const matrix = new Matrix4();
    vertexIndices.forEach((vertexIndex, instanceIndex) => {
      matrix.makeTranslation(
        object.mesh.positions[vertexIndex * 3]!,
        object.mesh.positions[vertexIndex * 3 + 1]!,
        object.mesh.positions[vertexIndex * 3 + 2]!,
      );
      markers.setMatrixAt(instanceIndex, matrix);
    });
    markers.instanceMatrix.needsUpdate = true;
    markers.renderOrder = 4;
    return markers;
  }
  #addEdgeOverlay(
    overlay: Group,
    object: ModelObjectSnapshot,
    selected: ReadonlySet<SelectionItem["elementId"]>,
    highlightSelection: boolean,
  ): void {
    const positions: number[] = [];
    const colors: number[] = [];
    for (const edge of object.mesh.edges) {
      const color =
        highlightSelection && selected.has(edge.id) ? selectedColor : baseColor;
      for (const index of edge.vertices) {
        positions.push(
          ...object.mesh.positions.slice(index * 3, index * 3 + 3),
        );
        colors.push(color.r, color.g, color.b);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    const lines = new LineSegments(
      geometry,
      new LineBasicMaterial({
        vertexColors: true,
        depthTest: false,
        transparent: true,
        opacity: highlightSelection ? 0.95 : 0.65,
      }),
    );
    lines.name = "edge-overlay";
    overlay.add(lines);
  }
  #updateEdgeSelection(
    overlay: Group,
    object: ModelObjectSnapshot,
    selected: ReadonlySet<SelectionItem["elementId"]>,
  ): void {
    const lines = overlay.getObjectByName("edge-overlay");
    if (!(lines instanceof LineSegments)) return;
    const colors = lines.geometry.getAttribute("color");
    object.mesh.edges.forEach((edge, edgeIndex) => {
      const color = selected.has(edge.id) ? selectedColor : baseColor;
      colors.setXYZ(edgeIndex * 2, color.r, color.g, color.b);
      colors.setXYZ(edgeIndex * 2 + 1, color.r, color.g, color.b);
    });
    colors.needsUpdate = true;
  }
  #addFaceOverlay(
    overlay: Group,
    object: ModelObjectSnapshot,
    selected: ReadonlySet<SelectionItem["elementId"]>,
  ): void {
    const indices: number[] = [];
    object.mesh.faces.forEach((face, faceIndex) => {
      if (!selected.has(object.mesh.faceIds[faceIndex]!)) return;
      for (let cursor = 1; cursor < face.length - 1; cursor += 1)
        indices.push(face[0]!, face[cursor]!, face[cursor + 1]!);
    });
    if (!indices.length) return;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(object.mesh.positions, 3),
    );
    geometry.setIndex(indices);
    const faces = new Mesh(
      geometry,
      new MeshBasicMaterial({
        color: selectedColor,
        transparent: true,
        opacity: 0.48,
        depthTest: false,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    faces.name = "face-selection-overlay";
    overlay.add(faces);
  }
  #addHoverEdge(
    overlay: Group,
    object: ModelObjectSnapshot,
    vertices: readonly [number, number],
  ): void {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        vertices.flatMap((index) =>
          object.mesh.positions.slice(index * 3, index * 3 + 3),
        ),
        3,
      ),
    );
    const line = new LineSegments(
      geometry,
      new LineBasicMaterial({
        color: hoverColor,
        depthTest: false,
        depthWrite: false,
      }),
    );
    line.renderOrder = 7;
    overlay.add(line);
  }
  #addHoverFace(
    overlay: Group,
    object: ModelObjectSnapshot,
    faceIndex: number,
  ): void {
    const face = object.mesh.faces[faceIndex];
    if (!face || face.length < 3) return;
    const indices: number[] = [];
    for (let cursor = 1; cursor < face.length - 1; cursor += 1)
      indices.push(face[0]!, face[cursor]!, face[cursor + 1]!);
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(object.mesh.positions, 3),
    );
    geometry.setIndex(indices);
    const faceMesh = new Mesh(
      geometry,
      new MeshBasicMaterial({
        color: hoverColor,
        transparent: true,
        opacity: 0.28,
        depthTest: false,
        depthWrite: false,
      }),
    );
    faceMesh.renderOrder = 7;
    overlay.add(faceMesh);
  }
  #addNormalOverlay(overlay: Group, object: ModelObjectSnapshot): void {
    const positions: number[] = [];
    const extent = object.mesh.positions.reduce(
      (largest, value) => Math.max(largest, Math.abs(value)),
      1,
    );
    const length = Math.max(0.15, extent * 0.15);
    for (const { center, normal } of collectFaceNormalSegments(object.mesh))
      positions.push(
        center.x,
        center.y,
        center.z,
        center.x + normal.x * length,
        center.y + normal.y * length,
        center.z + normal.z * length,
      );
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const normals = new LineSegments(
      geometry,
      new LineBasicMaterial({ color: 0x46d6c7, depthTest: false }),
    );
    normals.name = "normal-overlay";
    normals.renderOrder = 6;
    overlay.add(normals);
  }
  #disposeObject(object: import("three").Object3D): void {
    object.traverse((child) => {
      if (!(child instanceof Mesh || child instanceof LineSegments)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((material) => this.#disposeMaterial(material));
    });
  }
  #disposeMaterial(material: import("three").Material): void {
    if (
      material instanceof MeshBasicMaterial ||
      material instanceof MeshLambertMaterial ||
      material instanceof MeshPhongMaterial ||
      material instanceof MeshStandardMaterial
    )
      material.map?.dispose();
    if (material instanceof MeshStandardMaterial) {
      material.normalMap?.dispose();
      material.roughnessMap?.dispose();
      material.metalnessMap?.dispose();
    }
    material.dispose();
  }
  #remove(id: ObjectId, mesh: Mesh): void {
    if (this.#hoverItem?.objectId === id) this.#hoverItem = undefined;
    this.group.remove(mesh);
    this.#disposeObject(mesh);
    this.#meshes.delete(id);
    this.#meshRevisions.delete(id);
    this.#materialRevisions.delete(id);
    this.#overlayRevisions.delete(id);
  }
}
