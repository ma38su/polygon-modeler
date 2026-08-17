import { Euler, Matrix3, Matrix4, Quaternion, Vector3 } from "three";
import type {
  ModelObjectSnapshot,
  ObjectId,
} from "../../editor/document/types";
import type { SelectionItem } from "../../editor/selection/SelectionManager";
import type { RenderGeometryAdapter } from "../adapters/RenderGeometryAdapter";

export interface ElementSnapTargets {
  readonly vertex: boolean;
  readonly edge: boolean;
  readonly face: boolean;
}

export type TransformOrientation = "world" | "local" | "normal";

export interface SelectionFrame {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
}

export function objectSelectionFrameWorld(
  objects: readonly ModelObjectSnapshot[],
  selectedIds: ReadonlySet<ObjectId>,
  orientation: TransformOrientation,
): SelectionFrame | undefined {
  const selected = objects.filter((object) => selectedIds.has(object.id));
  if (!selected.length) return undefined;
  const position = selected
    .reduce(
      (sum, object) =>
        sum.add(
          new Vector3(
            object.transform.position.x,
            object.transform.position.y,
            object.transform.position.z,
          ),
        ),
      new Vector3(),
    )
    .multiplyScalar(1 / selected.length);
  const quaternion =
    orientation === "world"
      ? new Quaternion()
      : new Quaternion().setFromEuler(
          new Euler(
            selected[0]!.transform.rotation.x,
            selected[0]!.transform.rotation.y,
            selected[0]!.transform.rotation.z,
            "XYZ",
          ),
        );
  return { position, quaternion };
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

export function selectionFrameWorld(
  objects: readonly ModelObjectSnapshot[],
  selectionItems: readonly SelectionItem[],
  adapter: RenderGeometryAdapter,
  orientation: TransformOrientation,
): SelectionFrame | undefined {
  const position = selectionPivotWorld(objects, selectionItems, adapter);
  if (!position) return undefined;
  if (orientation === "world")
    return { position, quaternion: new Quaternion() };

  const selectedObject = objects.find((object) =>
    selectionItems.some((item) => item.objectId === object.id),
  );
  const renderMesh = selectedObject
    ? adapter.getMesh(selectedObject.id)
    : undefined;
  if (!selectedObject || !renderMesh)
    return { position, quaternion: new Quaternion() };
  renderMesh.updateWorldMatrix(true, false);
  const localQuaternion = new Quaternion();
  renderMesh.matrixWorld.decompose(
    new Vector3(),
    localQuaternion,
    new Vector3(),
  );
  if (orientation === "local") return { position, quaternion: localQuaternion };

  const selected = new Set(
    selectionItems
      .filter((item) => item.objectId === selectedObject.id)
      .map((item) => item.elementId),
  );
  const selectedIndices = selectedVertexIndices(selectedObject, selectionItems);
  const normal = new Vector3();
  const tangent = new Vector3();
  const normalMatrix = new Matrix3().getNormalMatrix(renderMesh.matrixWorld);
  selectedObject.mesh.faces.forEach((face, faceIndex) => {
    const faceSelected = selected.has(selectedObject.mesh.faceIds[faceIndex]!);
    const edgeOrVertexSelected = face.some((index) =>
      selectedIndices.has(index),
    );
    if (!faceSelected && !edgeOrVertexSelected) return;
    normal.add(faceNormal(selectedObject, face).applyMatrix3(normalMatrix));
  });
  for (const edge of selectedObject.mesh.edges) {
    if (!selected.has(edge.id)) continue;
    tangent
      .fromArray(selectedObject.mesh.positions, edge.vertices[1] * 3)
      .sub(
        new Vector3().fromArray(
          selectedObject.mesh.positions,
          edge.vertices[0] * 3,
        ),
      )
      .transformDirection(renderMesh.matrixWorld);
    break;
  }
  if (normal.lengthSq() < 1e-12)
    normal.set(0, 0, 1).applyQuaternion(localQuaternion);
  normal.normalize();
  if (tangent.lengthSq() < 1e-12)
    tangent.set(1, 0, 0).applyQuaternion(localQuaternion);
  tangent.addScaledVector(normal, -tangent.dot(normal));
  if (tangent.lengthSq() < 1e-12) tangent.set(0, 1, 0).cross(normal);
  tangent.normalize();
  const bitangent = new Vector3().crossVectors(normal, tangent).normalize();
  const basis = new Matrix4().makeBasis(tangent, bitangent, normal);
  return {
    position,
    quaternion: new Quaternion().setFromRotationMatrix(basis),
  };
}

function faceNormal(
  object: ModelObjectSnapshot,
  face: readonly number[],
): Vector3 {
  if (face.length < 3) return new Vector3();
  const a = new Vector3().fromArray(object.mesh.positions, face[0]! * 3);
  const b = new Vector3().fromArray(object.mesh.positions, face[1]! * 3);
  const c = new Vector3().fromArray(object.mesh.positions, face[2]! * 3);
  return b.sub(a).cross(c.sub(a)).normalize();
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
