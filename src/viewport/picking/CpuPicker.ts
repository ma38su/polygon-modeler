import { Raycaster, Vector2, Vector3, type Camera, type Mesh } from "three";
import type { ModelObjectSnapshot } from "../../editor/document/types";
import type {
  SelectionItem,
  SelectionMode,
} from "../../editor/selection/SelectionManager";
import type { RenderGeometryAdapter } from "../adapters/RenderGeometryAdapter";

export class CpuPicker {
  readonly #raycaster = new Raycaster();
  pick(
    x: number,
    y: number,
    bounds: DOMRect,
    camera: Camera,
    adapter: RenderGeometryAdapter,
    objects: readonly ModelObjectSnapshot[],
    mode: SelectionMode,
  ): SelectionItem | undefined {
    const pointer = new Vector2(
      ((x - bounds.left) / bounds.width) * 2 - 1,
      -((y - bounds.top) / bounds.height) * 2 + 1,
    );
    this.#raycaster.setFromCamera(pointer, camera);
    const hit = this.#raycaster.intersectObjects(
      adapter.group.children,
      false,
    )[0];
    if (!hit) return undefined;
    const mesh = hit.object as Mesh;
    const objectId = adapter.getObjectId(mesh);
    const object = objects.find((candidate) => candidate.id === objectId);
    if (!objectId || !object) return undefined;
    if (mode === "object") return { objectId, elementId: objectId };
    if (mode === "face") {
      const triangle = hit.faceIndex ?? 0;
      let cursor = 0;
      for (let index = 0; index < object.mesh.faces.length; index += 1) {
        const count = Math.max(0, object.mesh.faces[index]!.length - 2);
        if (triangle < cursor + count)
          return { objectId, elementId: object.mesh.faceIds[index]! };
        cursor += count;
      }
    }
    const tolerance = camera.position.distanceTo(hit.point) * 0.015;
    let best = Infinity;
    let elementId: SelectionItem["elementId"] | undefined;
    if (mode === "vertex")
      object.mesh.vertexIds.forEach((id, index) => {
        const point = new Vector3()
          .fromArray(object.mesh.positions, index * 3)
          .applyMatrix4(mesh.matrixWorld);
        const distance = this.#raycaster.ray.distanceToPoint(point);
        if (distance < tolerance && distance < best) {
          best = distance;
          elementId = id;
        }
      });
    if (mode === "edge")
      object.mesh.edges.forEach((edge) => {
        const start = new Vector3()
          .fromArray(object.mesh.positions, edge.vertices[0] * 3)
          .applyMatrix4(mesh.matrixWorld);
        const end = new Vector3()
          .fromArray(object.mesh.positions, edge.vertices[1] * 3)
          .applyMatrix4(mesh.matrixWorld);
        const onRay = new Vector3();
        const onEdge = new Vector3();
        const distance = Math.sqrt(
          this.#raycaster.ray.distanceSqToSegment(start, end, onRay, onEdge),
        );
        if (distance < tolerance && distance < best) {
          best = distance;
          elementId = edge.id;
        }
      });
    return elementId ? { objectId, elementId } : undefined;
  }
}
