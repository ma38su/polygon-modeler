import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import type {
  ModelObjectSnapshot,
  ObjectId,
} from "../../editor/document/types";
import { triangulate } from "../../editor/mesh/triangulate";
export class RenderGeometryAdapter {
  readonly group = new Group();
  readonly #meshes = new Map<ObjectId, Mesh>();
  readonly #meshRevisions = new Map<ObjectId, number>();
  sync(
    objects: readonly ModelObjectSnapshot[],
    selectedIds: ReadonlySet<ObjectId>,
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
      material.color.set(selectedIds.has(object.id) ? 0x78a0ff : 0x9aa5b5);
      material.emissive.set(selectedIds.has(object.id) ? 0x172a55 : 0x000000);
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
  #remove(id: ObjectId, mesh: Mesh): void {
    this.group.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as MeshStandardMaterial).dispose();
    this.#meshes.delete(id);
    this.#meshRevisions.delete(id);
  }
}
