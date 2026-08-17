import { Vector3, type Camera } from "three";
import type { ModelObjectSnapshot } from "../../editor/document/types";
import type {
  SelectionItem,
  SelectionMode,
} from "../../editor/selection/SelectionManager";
import type { RenderGeometryAdapter } from "../adapters/RenderGeometryAdapter";

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export type RegionShape = "box" | "lasso";

export class RegionPicker {
  pick(
    points: readonly ScreenPoint[],
    shape: RegionShape,
    bounds: DOMRect,
    camera: Camera,
    adapter: RenderGeometryAdapter,
    objects: readonly ModelObjectSnapshot[],
    modes: ReadonlySet<SelectionMode>,
  ): SelectionItem[] {
    const polygon = shape === "box" ? boxPolygon(points) : points;
    if (polygon.length < 3) return [];
    const items: SelectionItem[] = [];
    for (const object of objects) {
      if (!object.visible) continue;
      const mesh = adapter.getMesh(object.id);
      if (!mesh) continue;
      mesh.updateWorldMatrix(true, false);
      const projectVertex = (index: number) =>
        project(
          new Vector3()
            .fromArray(object.mesh.positions, index * 3)
            .applyMatrix4(mesh.matrixWorld),
          camera,
          bounds,
        );
      const fullyEnclosed = shape === "lasso";
      if (modes.has("vertex"))
        object.mesh.vertexIds.forEach((elementId, index) => {
          if (contains(polygon, projectVertex(index)))
            items.push({ objectId: object.id, elementId });
        });
      if (modes.has("edge"))
        object.mesh.edges.forEach((edge) => {
          const start = projectVertex(edge.vertices[0]);
          const end = projectVertex(edge.vertices[1]);
          if (
            fullyEnclosed
              ? contains(polygon, start) && contains(polygon, end)
              : contains(polygon, midpoint(start, end))
          )
            items.push({ objectId: object.id, elementId: edge.id });
        });
      if (modes.has("face"))
        object.mesh.faces.forEach((face, index) => {
          const vertices = face.map(projectVertex);
          const sum = vertices.reduce(
            (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
            { x: 0, y: 0 },
          );
          const center = { x: sum.x / face.length, y: sum.y / face.length };
          if (
            fullyEnclosed
              ? vertices.every((vertex) => contains(polygon, vertex))
              : contains(polygon, center)
          )
            items.push({
              objectId: object.id,
              elementId: object.mesh.faceIds[index]!,
            });
        });
    }
    return items;
  }
}

function boxPolygon(points: readonly ScreenPoint[]): ScreenPoint[] {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return [];
  return [
    { x: first.x, y: first.y },
    { x: last.x, y: first.y },
    { x: last.x, y: last.y },
    { x: first.x, y: last.y },
  ];
}

function project(point: Vector3, camera: Camera, bounds: DOMRect): ScreenPoint {
  const projected = point.project(camera);
  return {
    x: bounds.left + ((projected.x + 1) * bounds.width) / 2,
    y: bounds.top + ((1 - projected.y) * bounds.height) / 2,
  };
}

function midpoint(a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function contains(
  polygon: readonly ScreenPoint[],
  point: ScreenPoint,
): boolean {
  // A point on the lasso stroke counts as enclosed. This makes the result
  // stable when a stroke runs exactly through a projected vertex.
  if (
    polygon.some((start, index) =>
      pointOnSegment(start, polygon[(index + 1) % polygon.length]!, point),
    )
  )
    return true;
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const a = polygon[index]!;
    const b = polygon[previous]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

const CONTAINMENT_EPSILON = 1e-7;

function pointOnSegment(
  start: ScreenPoint,
  end: ScreenPoint,
  point: ScreenPoint,
): boolean {
  const cross =
    (point.x - start.x) * (end.y - start.y) -
    (point.y - start.y) * (end.x - start.x);
  if (Math.abs(cross) > CONTAINMENT_EPSILON) return false;
  return (
    point.x >= Math.min(start.x, end.x) - CONTAINMENT_EPSILON &&
    point.x <= Math.max(start.x, end.x) + CONTAINMENT_EPSILON &&
    point.y >= Math.min(start.y, end.y) - CONTAINMENT_EPSILON &&
    point.y <= Math.max(start.y, end.y) + CONTAINMENT_EPSILON
  );
}
