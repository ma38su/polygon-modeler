import type { BufferGeometry } from "three";
import type { ModelObjectSnapshot, Vector3Value } from "../document/types";
import { EditableMesh } from "../mesh/EditableMesh";
import { joinObjectMeshes } from "../mesh/objectOperations";
import { triangulate } from "../mesh/triangulate";

export type BooleanOperation = "union" | "subtract" | "intersect";

export async function evaluateBoolean(
  left: ModelObjectSnapshot,
  right: ModelObjectSnapshot,
  operation: BooleanOperation,
): Promise<EditableMesh> {
  assertClosed(left);
  assertClosed(right);

  const [{ BufferGeometry, Float32BufferAttribute }, csg, geometryUtils] =
    await Promise.all([
      import("three"),
      import("three-bvh-csg"),
      import("three/examples/jsm/utils/BufferGeometryUtils.js"),
    ]);
  const leftGeometry = toGeometry(
    joinObjectMeshes([left]),
    BufferGeometry,
    Float32BufferAttribute,
  );
  const rightGeometry = toGeometry(
    joinObjectMeshes([right]),
    BufferGeometry,
    Float32BufferAttribute,
  );
  const leftBrush = new csg.Brush(leftGeometry);
  const rightBrush = new csg.Brush(rightGeometry);
  leftBrush.updateMatrixWorld(true);
  rightBrush.updateMatrixWorld(true);
  const evaluator = new csg.Evaluator();
  evaluator.useGroups = false;
  evaluator.attributes = ["position", "normal"];

  const operationCode = {
    union: csg.ADDITION,
    subtract: csg.SUBTRACTION,
    intersect: csg.INTERSECTION,
  }[operation];
  const result = evaluator.evaluate(leftBrush, rightBrush, operationCode);

  try {
    // Normals split otherwise coincident result vertices, so weld positions first.
    result.geometry.deleteAttribute("normal");
    result.geometry.deleteAttribute("uv");
    const welded = geometryUtils.mergeVertices(result.geometry, 1e-5);
    try {
      const mesh = fromGeometry(welded);
      if (!mesh.faces.size)
        throw new Error("Boolean演算の結果が空になりました");
      return mesh;
    } finally {
      welded.dispose();
    }
  } catch (error) {
    throw new Error(
      `Boolean演算結果を編集メッシュへ変換できません: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    leftGeometry.dispose();
    rightGeometry.dispose();
    result.geometry.dispose();
  }
}

function assertClosed(object: ModelObjectSnapshot): void {
  const edgeUse = new Map<string, number>();
  for (const face of object.mesh.faces) {
    face.forEach((from, index) => {
      const to = face[(index + 1) % face.length]!;
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
    });
  }
  if ([...edgeUse.values()].some((count) => count !== 2))
    throw new Error(
      `${object.name}は閉じた立体ではないためBoolean演算できません`,
    );
}

function toGeometry(
  mesh: EditableMesh,
  Geometry: typeof import("three").BufferGeometry,
  PositionAttribute: typeof import("three").Float32BufferAttribute,
): BufferGeometry {
  const data = mesh.toMeshData();
  const geometry = new Geometry();
  geometry.setAttribute("position", new PositionAttribute(data.positions, 3));
  geometry.setIndex(triangulate(data));
  geometry.computeVertexNormals();
  return geometry;
}

function fromGeometry(geometry: BufferGeometry): EditableMesh {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!position || !index)
    throw new Error("頂点または面インデックスがありません");
  const positions: Vector3Value[] = [];
  for (let vertex = 0; vertex < position.count; vertex += 1)
    positions.push({
      x: position.getX(vertex),
      y: position.getY(vertex),
      z: position.getZ(vertex),
    });

  const start = Math.max(0, geometry.drawRange.start);
  const available = Math.min(
    index.count - start,
    Number.isFinite(geometry.drawRange.count)
      ? geometry.drawRange.count
      : index.count,
  );
  const end = start + available - (available % 3);
  const faces: number[][] = [];
  const seen = new Set<string>();
  for (let offset = start; offset < end; offset += 3) {
    const face = [
      index.getX(offset),
      index.getX(offset + 1),
      index.getX(offset + 2),
    ];
    if (new Set(face).size < 3 || triangleAreaSquared(face, positions) < 1e-16)
      continue;
    const key = [...face].sort((a, b) => a - b).join(":");
    if (!seen.has(key)) {
      seen.add(key);
      faces.push(face);
    }
  }
  return EditableMesh.fromPolygons(positions, faces);
}

function triangleAreaSquared(
  [aIndex, bIndex, cIndex]: readonly number[],
  positions: readonly Vector3Value[],
): number {
  const a = positions[aIndex!]!;
  const b = positions[bIndex!]!;
  const c = positions[cIndex!]!;
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const cross = {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x,
  };
  return cross.x ** 2 + cross.y ** 2 + cross.z ** 2;
}
