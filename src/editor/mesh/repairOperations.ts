import type { Vector3Value } from "../document/types";
import { EditableMesh } from "./EditableMesh";

export function mergeByDistance(
  mesh: EditableMesh,
  distance: number,
): EditableMesh {
  if (!Number.isFinite(distance) || distance <= 0)
    throw new Error("Merge距離は0より大きい値にしてください");
  const data = mesh.toMeshData();
  const positions = data.vertexIds.map((_, index) =>
    point(data.positions, index),
  );
  const representatives: Vector3Value[] = [];
  const remap: number[] = [];
  const cells = new Map<string, number[]>();
  const cellSize = distance;
  const limitSquared = distance * distance;
  for (const position of positions) {
    const cell = [
      Math.floor(position.x / cellSize),
      Math.floor(position.y / cellSize),
      Math.floor(position.z / cellSize),
    ];
    let match: number | undefined;
    for (let x = -1; x <= 1 && match === undefined; x += 1)
      for (let y = -1; y <= 1 && match === undefined; y += 1)
        for (let z = -1; z <= 1 && match === undefined; z += 1)
          for (const candidate of cells.get(
            key(cell[0]! + x, cell[1]! + y, cell[2]! + z),
          ) ?? [])
            if (
              distanceSquared(position, representatives[candidate]!) <=
              limitSquared
            ) {
              match = candidate;
              break;
            }
    if (match === undefined) {
      match = representatives.length;
      representatives.push(position);
      const cellKey = key(cell[0]!, cell[1]!, cell[2]!);
      cells.set(cellKey, [...(cells.get(cellKey) ?? []), match]);
    }
    remap.push(match);
  }
  const seen = new Set<string>();
  const faces: number[][] = [];
  for (const source of data.faces) {
    const face = removeConsecutiveDuplicates(
      source.map((index) => remap[index]!),
    );
    if (new Set(face).size < 3) continue;
    const faceKey = [...face].sort((a, b) => a - b).join(":");
    if (seen.has(faceKey)) continue;
    seen.add(faceKey);
    faces.push(face);
  }
  return compact(representatives, faces);
}

export function recalculateFaceNormals(mesh: EditableMesh): EditableMesh {
  const data = mesh.toMeshData();
  const faces = repairPolygonWinding(
    data.vertexIds.map((_, index) => point(data.positions, index)),
    data.faces,
  );
  return EditableMesh.fromPolygons(
    data.vertexIds.map((_, index) => point(data.positions, index)),
    faces,
  );
}

/** Repairs adjacent polygon winding before half-edge topology is constructed. */
export function repairPolygonWinding(
  positions: readonly Vector3Value[],
  polygons: readonly (readonly number[])[],
): number[][] {
  const faces = polygons.map((face) => [...face]);
  const edges = new Map<string, { face: number; from: number; to: number }[]>();
  const faceEdges: string[][] = faces.map(() => []);
  faces.forEach((face, faceIndex) =>
    face.forEach((from, index) => {
      const to = face[(index + 1) % face.length]!;
      const edgeKey = from < to ? `${from}:${to}` : `${to}:${from}`;
      faceEdges[faceIndex]!.push(edgeKey);
      edges.set(edgeKey, [
        ...(edges.get(edgeKey) ?? []),
        { face: faceIndex, from, to },
      ]);
    }),
  );
  const visited = new Set<number>();
  const flipped = new Set<number>();
  for (let start = 0; start < faces.length; start += 1) {
    if (visited.has(start)) continue;
    const component: number[] = [];
    const componentEdgeKeys = new Set<string>();
    const queue = [start];
    let queueIndex = 0;
    visited.add(start);
    while (queueIndex < queue.length) {
      const faceIndex = queue[queueIndex++]!;
      component.push(faceIndex);
      faceEdges[faceIndex]!.forEach((edgeKey) => {
        componentEdgeKeys.add(edgeKey);
        const uses = edges.get(edgeKey) ?? [];
        const currentUse = uses.find((use) => use.face === faceIndex)!;
        for (const neighbor of uses) {
          if (neighbor.face === faceIndex || visited.has(neighbor.face))
            continue;
          const sameDirection =
            neighbor.from === currentUse.from && neighbor.to === currentUse.to;
          if (flipped.has(faceIndex) !== sameDirection)
            flipped.add(neighbor.face);
          visited.add(neighbor.face);
          queue.push(neighbor.face);
        }
      });
    }
    component.forEach((faceIndex) => {
      if (flipped.has(faceIndex)) faces[faceIndex]!.reverse();
    });
    const componentEdges = [...componentEdgeKeys].map((key) => edges.get(key)!);
    const closed = componentEdges.every((uses) => uses.length === 2);
    if (closed && signedVolumeFromPoints(positions, faces, component) < 0)
      component.forEach((faceIndex) => faces[faceIndex]!.reverse());
  }
  return faces;
}

function signedVolumeFromPoints(
  positions: readonly Vector3Value[],
  faces: readonly (readonly number[])[],
  component: readonly number[],
): number {
  let volume = 0;
  for (const faceIndex of component) {
    const face = faces[faceIndex]!;
    const a = positions[face[0]!]!;
    for (let index = 1; index < face.length - 1; index += 1) {
      const b = positions[face[index]!]!;
      const c = positions[face[index + 1]!]!;
      volume +=
        (a.x * (b.y * c.z - b.z * c.y) +
          a.y * (b.z * c.x - b.x * c.z) +
          a.z * (b.x * c.y - b.y * c.x)) /
        6;
    }
  }
  return volume;
}

function compact(
  positions: readonly Vector3Value[],
  faces: readonly number[][],
) {
  const used = [...new Set(faces.flat())];
  const remap = new Map(used.map((index, next) => [index, next]));
  return EditableMesh.fromPolygons(
    used.map((index) => positions[index]!),
    faces.map((face) => face.map((index) => remap.get(index)!)),
  );
}

function removeConsecutiveDuplicates(face: readonly number[]): number[] {
  const result = face.filter((value, index) => value !== face[index - 1]);
  if (result.length > 1 && result[0] === result.at(-1)) result.pop();
  return result;
}

const key = (x: number, y: number, z: number) => `${x}:${y}:${z}`;
const distanceSquared = (a: Vector3Value, b: Vector3Value) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
const point = (positions: readonly number[], index: number): Vector3Value => ({
  x: positions[index * 3]!,
  y: positions[index * 3 + 1]!,
  z: positions[index * 3 + 2]!,
});
