import { Raycaster, Vector2, Vector3, type Camera, type Mesh } from "three";
import type { ModelObjectSnapshot } from "../../editor/document/types";
import type {
  SelectionItem,
  SelectionMode,
} from "../../editor/selection/SelectionManager";
import type { RenderGeometryAdapter } from "../adapters/RenderGeometryAdapter";

export class CpuPicker {
  readonly #raycaster = new Raycaster();
  static readonly vertexRadiusPx = 4;
  pickPrioritized(
    x: number,
    y: number,
    bounds: DOMRect,
    camera: Camera,
    adapter: RenderGeometryAdapter,
    objects: readonly ModelObjectSnapshot[],
    modes: ReadonlySet<SelectionMode>,
  ): SelectionItem | undefined {
    for (const mode of ["vertex", "edge", "face"] as const) {
      if (!modes.has(mode)) continue;
      const item = this.pick(x, y, bounds, camera, adapter, objects, mode);
      if (item) return item;
    }
    return undefined;
  }
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
    if (mode === "vertex")
      return this.#pickVertex(x, y, bounds, camera, adapter, objects);
    const hit = this.#raycaster.intersectObjects(
      adapter.group.children,
      false,
    )[0];
    if (!hit) return undefined;
    const mesh = hit.object as Mesh;
    const objectId = adapter.getObjectId(mesh);
    const object = objects.find((candidate) => candidate.id === objectId);
    if (!objectId || !object) return undefined;
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

  #pickVertex(
    x: number,
    y: number,
    bounds: DOMRect,
    camera: Camera,
    adapter: RenderGeometryAdapter,
    objects: readonly ModelObjectSnapshot[],
  ): SelectionItem | undefined {
    let bestDistance = CpuPicker.vertexRadiusPx;
    let bestDepth = Infinity;
    let result: SelectionItem | undefined;
    for (const object of objects) {
      if (!object.visible) continue;
      const mesh = adapter.getMesh(object.id);
      if (!mesh) continue;
      mesh.updateWorldMatrix(true, false);
      object.mesh.vertexIds.forEach((elementId, index) => {
        const projected = new Vector3()
          .fromArray(object.mesh.positions, index * 3)
          .applyMatrix4(mesh.matrixWorld)
          .project(camera);
        if (projected.z < -1 || projected.z > 1) return;
        const screenX = bounds.left + ((projected.x + 1) * bounds.width) / 2;
        const screenY = bounds.top + ((1 - projected.y) * bounds.height) / 2;
        const distance = Math.hypot(x - screenX, y - screenY);
        if (distance > CpuPicker.vertexRadiusPx) return;
        if (
          result &&
          (distance > bestDistance + 0.01 ||
            (Math.abs(distance - bestDistance) <= 0.01 &&
              projected.z >= bestDepth))
        )
          return;
        bestDistance = distance;
        bestDepth = projected.z;
        result = { objectId: object.id, elementId };
      });
    }
    return result;
  }
}
