import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
} from "three";
import type {
  ModelObjectSnapshot,
  ObjectId,
} from "../../editor/document/types";
import { triangulate } from "../../editor/mesh/triangulate";
import type {
  SelectionItem,
  SelectionMode,
} from "../../editor/selection/SelectionManager";

const OVERLAY_NAME = "selection-overlay";
const baseColor = new Color(0x6f7d91);
const selectedColor = new Color(0xffb84d);

export class RenderGeometryAdapter {
  readonly group = new Group();
  readonly #meshes = new Map<ObjectId, Mesh>();
  readonly #meshRevisions = new Map<ObjectId, number>();
  sync(
    objects: readonly ModelObjectSnapshot[],
    selectedIds: ReadonlySet<ObjectId>,
    selectionMode: SelectionMode = "object",
    selectionItems: readonly SelectionItem[] = [],
  ): void {
    const liveIds = new Set(objects.map((object) => object.id));
    for (const [id, mesh] of this.#meshes)
      if (!liveIds.has(id)) this.#remove(id, mesh);
    for (const object of objects) {
      let mesh = this.#meshes.get(object.id);
      if (!mesh) {
        mesh = this.#createMesh(object);
        this.#meshes.set(object.id, mesh);
        this.group.add(mesh);
        this.#meshRevisions.set(object.id, object.mesh.revision);
      } else if (this.#meshRevisions.get(object.id) !== object.mesh.revision) {
        mesh.geometry.dispose();
        mesh.geometry = this.#createGeometry(object);
        this.#meshRevisions.set(object.id, object.mesh.revision);
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
      const material = mesh.material as MeshStandardMaterial;
      const objectSelected =
        selectionMode === "object" && selectedIds.has(object.id);
      material.color.set(objectSelected ? 0x78a0ff : 0x9aa5b5);
      material.emissive.set(objectSelected ? 0x172a55 : 0x000000);
      this.#syncOverlay(mesh, object, selectionMode, selectionItems);
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
    return new Mesh(
      this.#createGeometry(object),
      new MeshStandardMaterial({
        color: 0x9aa5b5,
        roughness: 0.72,
        metalness: 0.05,
      }),
    );
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
    mode: SelectionMode,
    items: readonly SelectionItem[],
  ): void {
    const previous = mesh.getObjectByName(OVERLAY_NAME);
    if (previous) {
      mesh.remove(previous);
      this.#disposeObject(previous);
    }
    if (mode === "object") return;
    const selected = new Set(
      items
        .filter((item) => item.objectId === object.id)
        .map((item) => item.elementId),
    );
    const overlay = new Group();
    overlay.name = OVERLAY_NAME;
    overlay.renderOrder = 4;
    if (mode === "vertex") this.#addVertexOverlay(overlay, object, selected);
    else {
      this.#addEdgeOverlay(overlay, object, selected, mode === "edge");
      if (mode === "face") this.#addFaceOverlay(overlay, object, selected);
    }
    mesh.add(overlay);
  }
  #addVertexOverlay(
    overlay: Group,
    object: ModelObjectSnapshot,
    selected: ReadonlySet<SelectionItem["elementId"]>,
  ): void {
    const colors = object.mesh.vertexIds.flatMap((id) => {
      const color = selected.has(id) ? selectedColor : baseColor;
      return [color.r, color.g, color.b];
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(object.mesh.positions, 3),
    );
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    const points = new Points(
      geometry,
      new PointsMaterial({
        size: 7,
        sizeAttenuation: false,
        vertexColors: true,
        depthTest: false,
      }),
    );
    points.name = "vertex-overlay";
    overlay.add(points);
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
  #disposeObject(object: import("three").Object3D): void {
    object.traverse((child) => {
      if (!(
        child instanceof Mesh ||
        child instanceof Points ||
        child instanceof LineSegments
      ))
        return;
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
  }
}
