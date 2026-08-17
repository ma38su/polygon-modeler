import { Vector3 } from "three";
import type { ModelObjectSnapshot } from "../../editor/document/types";
import type { SelectionItem } from "../../editor/selection/SelectionManager";
import type { RenderGeometryAdapter } from "../adapters/RenderGeometryAdapter";

export interface ElementSnapTargets {
  readonly vertex: boolean;
  readonly edge: boolean;
  readonly face: boolean;
}

export function selectedVertexIndices(
  object: ModelObjectSnapshot,
  selectionItems: readonly SelectionItem[],
): Set<number> {
  const result = new Set<number>();
  const selected = new Set(
    selectionItems
      .filter((item) => item.objectId === object.id)
      .map((item) => item.elementId),
  );
  object.mesh.vertexIds.forEach((id, index) => {
    if (selected.has(id)) result.add(index);
  });
  object.mesh.edges.forEach((edge) => {
    if (!selected.has(edge.id)) return;
    result.add(edge.vertices[0]);
    result.add(edge.vertices[1]);
  });
  object.mesh.faceIds.forEach((id, index) => {
    if (selected.has(id))
      object.mesh.faces[index]?.forEach((vertex) => result.add(vertex));
  });
  return result;
}

export function selectionPivotWorld(
  objects: readonly ModelObjectSnapshot[],
  selectionItems: readonly SelectionItem[],
  adapter: RenderGeometryAdapter,
): Vector3 | undefined {
  const points: Vector3[] = [];
  for (const object of objects) {
    const mesh = adapter.getMesh(object.id);
    if (!mesh) continue;
    mesh.updateWorldMatrix(true, false);
    for (const index of selectedVertexIndices(object, selectionItems))
      points.push(
        new Vector3()
          .fromArray(object.mesh.positions, index * 3)
          .applyMatrix4(mesh.matrixWorld),
      );
  }
  if (!points.length) return undefined;
  return points
    .reduce((sum, point) => sum.add(point), new Vector3())
    .multiplyScalar(1 / points.length);
}

export function collectSnapCandidates(
  objects: readonly ModelObjectSnapshot[],
  selectionItems: readonly SelectionItem[],
  adapter: RenderGeometryAdapter,
  targets: ElementSnapTargets,
): Vector3[] {
  const candidates: Vector3[] = [];
  for (const object of objects) {
    const mesh = adapter.getMesh(object.id);
    if (!mesh || !object.visible) continue;
    mesh.updateWorldMatrix(true, false);
    const selected = selectedVertexIndices(object, selectionItems);
    const point = (index: number) =>
      new Vector3()
        .fromArray(object.mesh.positions, index * 3)
        .applyMatrix4(mesh.matrixWorld);
    if (targets.vertex)
      object.mesh.vertexIds.forEach((_, index) => {
        if (!selected.has(index)) candidates.push(point(index));
      });
    if (targets.edge)
      object.mesh.edges.forEach((edge) => {
        if (!selected.has(edge.vertices[0]) && !selected.has(edge.vertices[1]))
          candidates.push(
            point(edge.vertices[0])
              .add(point(edge.vertices[1]))
              .multiplyScalar(0.5),
          );
      });
    if (targets.face)
      object.mesh.faces.forEach((face) => {
        if (!face.some((index) => selected.has(index)))
          candidates.push(
            face
              .reduce((sum, index) => sum.add(point(index)), new Vector3())
              .multiplyScalar(1 / face.length),
          );
      });
  }
  return candidates;
}
