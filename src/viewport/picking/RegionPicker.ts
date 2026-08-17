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
      if (modes.has("vertex"))
        object.mesh.vertexIds.forEach((elementId, index) => {
          if (contains(polygon, projectVertex(index)))
            items.push({ objectId: object.id, elementId });
        });
      if (modes.has("edge"))
        object.mesh.edges.forEach((edge) => {
          const start = projectVertex(edge.vertices[0]);
          const end = projectVertex(edge.vertices[1]);
          if (contains(polygon, midpoint(start, end)))
            items.push({ objectId: object.id, elementId: edge.id });
        });
      if (modes.has("face"))
        object.mesh.faces.forEach((face, index) => {
          const sum = face
            .map(projectVertex)
            .reduce(
              (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
              { x: 0, y: 0 },
            );
          const center = { x: sum.x / face.length, y: sum.y / face.length };
          if (contains(polygon, center))
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
