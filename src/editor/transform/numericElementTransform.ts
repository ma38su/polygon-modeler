import { Euler, Matrix3, Matrix4, Quaternion, Vector3 } from "three";
import type { ModelObjectSnapshot, Vector3Value } from "../document/types";
import type { SelectionItem } from "../selection/SelectionManager";
import type { TransformOrientation } from "../../viewport/transform/elementSelection";
import type {
  ElementTransformUpdate,
  TransformMode,
} from "../../viewport/Viewport";

export function numericElementTransformUpdates(
  objects: readonly ModelObjectSnapshot[],
  selectionItems: readonly SelectionItem[],
  mode: TransformMode,
  values: Vector3Value,
  orientation: TransformOrientation,
): ElementTransformUpdate[] {
  const frame = selectionFrame(objects, selectionItems, orientation);
  if (!frame) return [];
  const delta = deltaMatrix(frame.position, frame.quaternion, mode, values);
  const updates: ElementTransformUpdate[] = [];
  for (const object of objects) {
    const indices = selectedIndices(object, selectionItems);
    if (!indices.size) continue;
    const world = objectMatrix(object);
    const inverse = world.clone().invert();
    updates.push({
      objectId: object.id,
      vertices: [...indices].map((index) => {
        const position = new Vector3()
          .fromArray(object.mesh.positions, index * 3)
          .applyMatrix4(world)
          .applyMatrix4(delta)
          .applyMatrix4(inverse);
        return {
          id: object.mesh.vertexIds[index]!,
          position: { x: position.x, y: position.y, z: position.z },
        };
      }),
    });
  }
  return updates;
}

function deltaMatrix(
  pivot: Vector3,
  orientation: Quaternion,
  mode: TransformMode,
  values: Vector3Value,
): Matrix4 {
  if (mode === "translate") {
    const offset = new Vector3(values.x, values.y, values.z).applyQuaternion(
      orientation,
    );
    return new Matrix4().makeTranslation(offset.x, offset.y, offset.z);
  }
  const frame = new Matrix4().compose(pivot, orientation, new Vector3(1, 1, 1));
  const operation =
    mode === "rotate"
      ? new Matrix4().makeRotationFromEuler(
          new Euler(values.x, values.y, values.z, "XYZ"),
        )
      : new Matrix4().makeScale(values.x, values.y, values.z);
  const inverseFrame = frame.clone().invert();
  return frame.multiply(operation).multiply(inverseFrame);
}

function selectionFrame(
  objects: readonly ModelObjectSnapshot[],
  selectionItems: readonly SelectionItem[],
  orientation: TransformOrientation,
): { position: Vector3; quaternion: Quaternion } | undefined {
  const points: Vector3[] = [];
  for (const object of objects) {
    const world = objectMatrix(object);
    for (const index of selectedIndices(object, selectionItems))
      points.push(
        new Vector3()
          .fromArray(object.mesh.positions, index * 3)
          .applyMatrix4(world),
      );
  }
  if (!points.length) return undefined;
  const position = points
    .reduce((sum, point) => sum.add(point), new Vector3())
    .multiplyScalar(1 / points.length);
  if (orientation === "world")
    return { position, quaternion: new Quaternion() };
  const object = objects.find((candidate) =>
    selectionItems.some((item) => item.objectId === candidate.id),
  );
  if (!object) return { position, quaternion: new Quaternion() };
  const world = objectMatrix(object);
  const local = new Quaternion();
  world.decompose(new Vector3(), local, new Vector3());
  if (orientation === "local") return { position, quaternion: local };
  const selected = new Set(
    selectionItems
      .filter((item) => item.objectId === object.id)
      .map((item) => item.elementId),
  );
  const indices = selectedIndices(object, selectionItems);
  const normal = new Vector3();
  const tangent = new Vector3();
  const normalMatrix = new Matrix3().getNormalMatrix(world);
  object.mesh.faces.forEach((face, faceIndex) => {
    if (
      !selected.has(object.mesh.faceIds[faceIndex]!) &&
      !face.some((index) => indices.has(index))
    )
      return;
    normal.add(faceNormal(object, face).applyMatrix3(normalMatrix));
  });
  for (const edge of object.mesh.edges) {
    if (!selected.has(edge.id)) continue;
    tangent
      .fromArray(object.mesh.positions, edge.vertices[1] * 3)
      .sub(new Vector3().fromArray(object.mesh.positions, edge.vertices[0] * 3))
      .transformDirection(world);
    break;
  }
  if (normal.lengthSq() < 1e-12) normal.set(0, 0, 1).applyQuaternion(local);
  normal.normalize();
  if (tangent.lengthSq() < 1e-12) tangent.set(1, 0, 0).applyQuaternion(local);
  tangent.addScaledVector(normal, -tangent.dot(normal));
  if (tangent.lengthSq() < 1e-12) tangent.set(0, 1, 0).cross(normal);
  tangent.normalize();
  const bitangent = new Vector3().crossVectors(normal, tangent).normalize();
  return {
    position,
    quaternion: new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(tangent, bitangent, normal),
    ),
  };
}

function objectMatrix(object: ModelObjectSnapshot): Matrix4 {
  const { position, rotation, scale } = object.transform;
  return new Matrix4().compose(
    new Vector3(position.x, position.y, position.z),
    new Quaternion().setFromEuler(
      new Euler(rotation.x, rotation.y, rotation.z, "XYZ"),
    ),
    new Vector3(scale.x, scale.y, scale.z),
  );
}

function selectedIndices(
  object: ModelObjectSnapshot,
  items: readonly SelectionItem[],
): Set<number> {
  const result = new Set<number>();
  const selected = new Set(
    items
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
