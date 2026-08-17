import type { ModelObjectSnapshot, Vector3Value } from "../document/types";
import { EditableMesh } from "./EditableMesh";

export function extractFaces(
  mesh: EditableMesh,
  faceIds: ReadonlySet<string>,
  selected: boolean,
): EditableMesh {
  const data = mesh.toMeshData();
  const faces = data.faces.filter(
    (_, index) => selected === faceIds.has(data.faceIds[index]!),
  );
  return compactMesh(data.positions, faces);
}

export function joinObjectMeshes(
  objects: readonly ModelObjectSnapshot[],
): EditableMesh {
  const positions: Vector3Value[] = [];
  const faces: number[][] = [];
  for (const object of objects) {
    const offset = positions.length;
    for (let index = 0; index < object.mesh.positions.length; index += 3)
      positions.push(
        applyTransform(
          {
            x: object.mesh.positions[index]!,
            y: object.mesh.positions[index + 1]!,
            z: object.mesh.positions[index + 2]!,
          },
          object.transform,
        ),
      );
    object.mesh.faces.forEach((face) =>
      faces.push(face.map((index) => index + offset)),
    );
  }
  return EditableMesh.fromPolygons(positions, faces);
}

function compactMesh(
  sourcePositions: readonly number[],
  sourceFaces: readonly (readonly number[])[],
): EditableMesh {
  const used = [...new Set(sourceFaces.flat())];
  const remap = new Map(used.map((index, next) => [index, next]));
  return EditableMesh.fromPolygons(
    used.map((index) => ({
      x: sourcePositions[index * 3]!,
      y: sourcePositions[index * 3 + 1]!,
      z: sourcePositions[index * 3 + 2]!,
    })),
    sourceFaces.map((face) => face.map((index) => remap.get(index)!)),
  );
}

function applyTransform(
  point: Vector3Value,
  transform: ModelObjectSnapshot["transform"],
): Vector3Value {
  let x = point.x * transform.scale.x;
  let y = point.y * transform.scale.y;
  let z = point.z * transform.scale.z;
  const { rotation, position } = transform;
  const [cx, sx, cy, sy, cz, sz] = [
    Math.cos(rotation.x),
    Math.sin(rotation.x),
    Math.cos(rotation.y),
    Math.sin(rotation.y),
    Math.cos(rotation.z),
    Math.sin(rotation.z),
  ];
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  [x, y] = [x * cz - y * sz, x * sz + y * cz];
  return { x: x + position.x, y: y + position.y, z: z + position.z };
}
