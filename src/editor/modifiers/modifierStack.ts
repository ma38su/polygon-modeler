import type { ModifierValue, Vector3Value } from "../document/types";
import { EditableMesh } from "../mesh/EditableMesh";
import { bevelElements } from "../mesh/topologyOperations";
import { projectUv } from "../mesh/uvOperations";

export type MeshModifier = ModifierValue;

export function evaluateModifierStack(
  source: EditableMesh,
  modifiers: readonly MeshModifier[],
): EditableMesh {
  let result = modifiers.reduce(
    (mesh, modifier) =>
      modifier.enabled ? evaluateModifier(mesh, modifier) : mesh,
    source.clone(),
  );
  if (
    [...source.halfEdges.values()].some((halfEdge) => halfEdge.uv) &&
    ![...result.halfEdges.values()].some((halfEdge) => halfEdge.uv)
  )
    result = projectUv(result, new Set(result.faces.keys()), "xz");
  return result;
}

export function evaluateModifier(
  mesh: EditableMesh,
  modifier: MeshModifier,
): EditableMesh {
  if (modifier.type === "mirror")
    return mirrorWithOriginal(mesh, modifier.axis);
  if (modifier.type === "array")
    return arrayMesh(mesh, modifier.count, modifier.offset);
  if (modifier.type === "solidify")
    return solidifyMesh(mesh, modifier.thickness);
  if (modifier.type === "bevel")
    return bevelElements(
      mesh,
      new Set(),
      new Set(mesh.edges.keys()),
      Math.max(0.001, Math.min(0.49, modifier.amount)),
    );
  let result = mesh.clone();
  for (
    let level = 0;
    level < Math.max(0, Math.min(4, modifier.levels));
    level += 1
  )
    result = subdivideMesh(result);
  return result;
}

function data(mesh: EditableMesh) {
  const value = mesh.toMeshData();
  return {
    positions: value.vertexIds.map((_, index) => ({
      x: value.positions[index * 3]!,
      y: value.positions[index * 3 + 1]!,
      z: value.positions[index * 3 + 2]!,
    })),
    faces: value.faces.map((face) => [...face]),
  };
}

function mirrorWithOriginal(mesh: EditableMesh, axis: "x" | "y" | "z") {
  const source = data(mesh);
  const offset = source.positions.length;
  const mirrored = source.positions.map((point) => ({
    x: axis === "x" ? -point.x : point.x,
    y: axis === "y" ? -point.y : point.y,
    z: axis === "z" ? -point.z : point.z,
  }));
  return EditableMesh.fromPolygons(
    [...source.positions, ...mirrored],
    [
      ...source.faces,
      ...source.faces.map((face) =>
        face.map((index) => index + offset).reverse(),
      ),
    ],
  );
}

function arrayMesh(mesh: EditableMesh, count: number, offset: Vector3Value) {
  const source = data(mesh);
  const copies = Math.max(1, Math.min(100, Math.floor(count)));
  const positions: Vector3Value[] = [];
  const faces: number[][] = [];
  for (let copy = 0; copy < copies; copy += 1) {
    const start = positions.length;
    positions.push(
      ...source.positions.map((point) => ({
        x: point.x + offset.x * copy,
        y: point.y + offset.y * copy,
        z: point.z + offset.z * copy,
      })),
    );
    faces.push(
      ...source.faces.map((face) => face.map((index) => index + start)),
    );
  }
  return EditableMesh.fromPolygons(positions, faces);
}

function solidifyMesh(mesh: EditableMesh, thickness: number) {
  const source = data(mesh);
  const normals = source.positions.map(() => ({ x: 0, y: 0, z: 0 }));
  const edgeUse = new Map<
    string,
    { count: number; from: number; to: number }
  >();
  for (const face of source.faces) {
    const a = source.positions[face[0]!]!,
      b = source.positions[face[1]!]!,
      c = source.positions[face[2]!]!;
    const ux = b.x - a.x,
      uy = b.y - a.y,
      uz = b.z - a.z;
    const vx = c.x - a.x,
      vy = c.y - a.y,
      vz = c.z - a.z;
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    face.forEach((index) => {
      normals[index]!.x += nx;
      normals[index]!.y += ny;
      normals[index]!.z += nz;
    });
    face.forEach((from, index) => {
      const to = face[(index + 1) % face.length]!;
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      const prior = edgeUse.get(key);
      edgeUse.set(
        key,
        prior ? { ...prior, count: prior.count + 1 } : { count: 1, from, to },
      );
    });
  }
  const half = thickness / 2;
  const top = source.positions.map((point, index) =>
    offsetNormal(point, normals[index]!, half),
  );
  const bottom = source.positions.map((point, index) =>
    offsetNormal(point, normals[index]!, -half),
  );
  const offset = top.length;
  const faces = [
    ...source.faces,
    ...source.faces.map((face) =>
      face.map((index) => index + offset).reverse(),
    ),
  ];
  for (const edge of edgeUse.values())
    if (edge.count === 1)
      faces.push([edge.to, edge.from, edge.from + offset, edge.to + offset]);
  return EditableMesh.fromPolygons([...top, ...bottom], faces);
}

function offsetNormal(
  point: Vector3Value,
  normal: Vector3Value,
  amount: number,
) {
  const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
  return {
    x: point.x + (normal.x / length) * amount,
    y: point.y + (normal.y / length) * amount,
    z: point.z + (normal.z / length) * amount,
  };
}

function subdivideMesh(mesh: EditableMesh) {
  const source = data(mesh);
  const positions = [...source.positions];
  const midpoint = new Map<string, number>();
  const edgePoint = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const existing = midpoint.get(key);
    if (existing !== undefined) return existing;
    const first = source.positions[a]!,
      second = source.positions[b]!;
    const index = positions.length;
    positions.push({
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
      z: (first.z + second.z) / 2,
    });
    midpoint.set(key, index);
    return index;
  };
  const faces: number[][] = [];
  for (const face of source.faces) {
    const center = face.reduce(
      (sum, index) => ({
        x: sum.x + source.positions[index]!.x / face.length,
        y: sum.y + source.positions[index]!.y / face.length,
        z: sum.z + source.positions[index]!.z / face.length,
      }),
      { x: 0, y: 0, z: 0 },
    );
    const centerIndex = positions.push(center) - 1;
    face.forEach((vertex, index) => {
      const previous = face.at(index - 1)!;
      const next = face[(index + 1) % face.length]!;
      faces.push([
        vertex,
        edgePoint(vertex, next),
        centerIndex,
        edgePoint(previous, vertex),
      ]);
    });
  }
  return EditableMesh.fromPolygons(positions, faces);
}
