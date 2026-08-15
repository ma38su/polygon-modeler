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
export class RenderGeometryAdapter {
  readonly group = new Group();
  readonly #meshes = new Map<ObjectId, Mesh>();
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
  #createMesh(object: ModelObjectSnapshot): Mesh {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(object.mesh.positions, 3),
    );
    const indices: number[] = [];
    for (const face of object.mesh.faces)
      for (let index = 1; index < face.length - 1; index += 1) {
        const [a, b, c] = [face[0], face[index], face[index + 1]];
        if (a !== undefined && b !== undefined && c !== undefined)
          indices.push(a, b, c);
      }
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return new Mesh(
      geometry,
      new MeshStandardMaterial({
        color: 0x9aa5b5,
        roughness: 0.72,
        metalness: 0.05,
      }),
    );
  }
  #remove(id: ObjectId, mesh: Mesh): void {
    this.group.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as MeshStandardMaterial).dispose();
    this.#meshes.delete(id);
  }
}
