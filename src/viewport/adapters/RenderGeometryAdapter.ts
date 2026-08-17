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
  SphereGeometry,
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
      const geometryRevision = `${geometryEpoch}:${object.mesh.revision}`;
      let mesh = this.#meshes.get(object.id);
      if (!mesh) {
        mesh = this.#createMesh(object);
        this.#meshes.set(object.id, mesh);
        this.group.add(mesh);
        this.#meshRevisions.set(object.id, geometryRevision);
        this.#materialRevisions.set(object.id, JSON.stringify(object.material));
      } else if (this.#meshRevisions.get(object.id) !== geometryRevision) {
        mesh.geometry.dispose();
        mesh.geometry = this.#createGeometry(object);
        this.#meshRevisions.set(object.id, geometryRevision);
      }
      const materialRevision = JSON.stringify(object.material);
      if (this.#materialRevisions.get(object.id) !== materialRevision) {
        (mesh.material as SurfaceMaterial).dispose();
        mesh.material = this.#createMaterial(object);
        this.#materialRevisions.set(object.id, materialRevision);
      }
      mesh.name = object.name;
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
      this.#syncOverlay(mesh, object, selectionItems, displayLayers);
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
  #createMesh(object: ModelObjectSnapshot): Mesh {
    return new Mesh(this.#createGeometry(object), this.#createMaterial(object));
  }

  #createMaterial(object: ModelObjectSnapshot): SurfaceMaterial {
    const common = { color: object.material.color, side: DoubleSide };
    if (object.material.shading === "basic")
      return new MeshBasicMaterial(common);
    if (object.material.shading === "lambert")
      return new MeshLambertMaterial(common);
    if (object.material.shading === "phong")
      return new MeshPhongMaterial({ ...common, shininess: 48 });
    return new MeshStandardMaterial({
      ...common,
      roughness: object.material.roughness,
      metalness: object.material.metalness,
    });
  }

  #createGeometry(object: ModelObjectSnapshot): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(object.mesh.positions, 3),
    );
    geometry.setIndex(triangulate(object.mesh));
    geometry.computeVertexNormals();
    return geometry;
  }
  #syncOverlay(
    mesh: Mesh,
    object: ModelObjectSnapshot,
    items: readonly SelectionItem[],
    displayLayers: DisplayLayers,
  ): void {
    const previous = mesh.getObjectByName(OVERLAY_NAME);
    if (previous) {
      mesh.remove(previous);
      this.#disposeObject(previous);
    }
    const selected = new Set(
      items
        .filter((item) => item.objectId === object.id)
        .map((item) => item.elementId),
    );
    const overlay = new Group();
    overlay.name = OVERLAY_NAME;
    overlay.renderOrder = 4;
    if (displayLayers.vertices)
      this.#addVertexOverlay(overlay, object, selected, true);
    if (displayLayers.edges)
      this.#addEdgeOverlay(overlay, object, selected, true);
    if (displayLayers.faces) this.#addFaceOverlay(overlay, object, selected);
    if (displayLayers.normals) this.#addNormalOverlay(overlay, object);
    if (overlay.children.length === 0) return;
    mesh.add(overlay);
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
    if (!highlightSelection || selected.size === 0) return;
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
      materials.forEach((material) => material.dispose());
    });
  }
  #remove(id: ObjectId, mesh: Mesh): void {
    this.group.remove(mesh);
    this.#disposeObject(mesh);
    this.#meshes.delete(id);
    this.#meshRevisions.delete(id);
    this.#materialRevisions.delete(id);
  }
}
