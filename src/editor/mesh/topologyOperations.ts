import { EditableMesh } from "./EditableMesh";
import type { EdgeId, FaceId, Vector3Value, VertexId } from "../document/types";
import { collectQuadEdgeRing, edgePairKey } from "./edgeLoop";

const vector = (positions: readonly number[], index: number): Vector3Value => ({
  x: positions[index * 3]!,
  y: positions[index * 3 + 1]!,
  z: positions[index * 3 + 2]!,
});
const normal = (
  positions: readonly number[],
  face: readonly number[],
): Vector3Value => {
  const a = vector(positions, face[0]!);
  const b = vector(positions, face[1]!);
  const c = vector(positions, face[2]!);
  const ux = b.x - a.x,
    uy = b.y - a.y,
    uz = b.z - a.z,
    vx = c.x - a.x,
    vy = c.y - a.y,
    vz = c.z - a.z;
  const x = uy * vz - uz * vy,
    y = uz * vx - ux * vz,
    z = ux * vy - uy * vx;
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
};

export function extrudeFaces(
  mesh: EditableMesh,
  faceIds: ReadonlySet<FaceId>,
  distance: number,
): EditableMesh {
  const data = mesh.toMeshData();
  const selectedIndices = data.faceIds.flatMap((id, index) =>
    faceIds.has(id) ? [index] : [],
  );
  if (!selectedIndices.length) return mesh.clone();
  const positions: number[] = [...data.positions];
  const polygons = data.faces
    .filter((_, index) => !selectedIndices.includes(index))
    .map((face) => [...face]);
  const selectedVertices = new Set(
    selectedIndices.flatMap((index) => [...data.faces[index]!]),
  );
  const duplicate = new Map<number, number>();
  for (const index of selectedVertices) {
    const adjacent = selectedIndices.filter((faceIndex) =>
      data.faces[faceIndex]!.includes(index),
    );
    const average = adjacent
      .map((faceIndex) => normal(data.positions, data.faces[faceIndex]!))
      .reduce(
        (sum, n) => ({ x: sum.x + n.x, y: sum.y + n.y, z: sum.z + n.z }),
        { x: 0, y: 0, z: 0 },
      );
    const length = Math.hypot(average.x, average.y, average.z) || 1;
    const point = vector(data.positions, index);
    duplicate.set(index, positions.length / 3);
    positions.push(
      point.x + (average.x / length) * distance,
      point.y + (average.y / length) * distance,
      point.z + (average.z / length) * distance,
    );
  }
  const selectedSet = new Set(selectedIndices);
  for (const faceIndex of selectedIndices) {
    const face = data.faces[faceIndex]!;
    polygons.push(face.map((index) => duplicate.get(index)!));
    for (let cursor = 0; cursor < face.length; cursor++) {
      const a = face[cursor]!,
        b = face[(cursor + 1) % face.length]!;
      const shared = selectedIndices.some(
        (other) =>
          other !== faceIndex &&
          selectedSet.has(other) &&
          data.faces[other]!.some(
            (value, i, array) =>
              value === b && array[(i + 1) % array.length] === a,
          ),
      );
      if (!shared) polygons.push([a, b, duplicate.get(b)!, duplicate.get(a)!]);
    }
  }
  return EditableMesh.fromPolygons(
    Array.from({ length: positions.length / 3 }, (_, index) =>
      vector(positions, index),
    ),
    polygons,
  );
}

export function insetFaces(
  mesh: EditableMesh,
  faceIds: ReadonlySet<FaceId>,
  amount: number,
): EditableMesh {
  if (!Number.isFinite(amount) || amount < 0 || amount >= 1)
    throw new Error("インセット率は0以上1未満で指定してください。");
  const data = mesh.toMeshData();
  const selected = new Set(
    data.faceIds.flatMap((id, index) => (faceIds.has(id) ? [index] : [])),
  );
  if (!selected.size) return mesh.clone();
  const positions = [...data.positions];
  const polygons = data.faces
    .filter((_, index) => !selected.has(index))
    .map((face) => [...face]);
  for (const faceIndex of selected) {
    const face = data.faces[faceIndex]!;
    const center = face
      .map((index) => vector(data.positions, index))
      .reduce(
        (sum, point) => ({
          x: sum.x + point.x / face.length,
          y: sum.y + point.y / face.length,
          z: sum.z + point.z / face.length,
        }),
        { x: 0, y: 0, z: 0 },
      );
    const inner = face.map((index) => {
      const point = vector(data.positions, index);
      const next = positions.length / 3;
      positions.push(
        point.x + (center.x - point.x) * amount,
        point.y + (center.y - point.y) * amount,
        point.z + (center.z - point.z) * amount,
      );
      return next;
    });
    polygons.push(inner);
    face.forEach((vertex, cursor) => {
      const next = (cursor + 1) % face.length;
      polygons.push([vertex, face[next]!, inner[next]!, inner[cursor]!]);
    });
  }
  return EditableMesh.fromPolygons(
    Array.from({ length: positions.length / 3 }, (_, index) =>
      vector(positions, index),
    ),
    polygons,
  );
}

export function bevelElements(
  mesh: EditableMesh,
  vertexIds: ReadonlySet<VertexId>,
  edgeIds: ReadonlySet<EdgeId>,
  amount: number,
): EditableMesh {
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 0.5)
    throw new Error("ベベル率は0より大きく0.5未満で指定してください。");
  const selected = new Set(vertexIds);
  for (const edgeId of edgeIds) {
    const edge = mesh.edges.get(edgeId);
    const halfEdge = edge && mesh.halfEdges.get(edge.halfEdges[0]!);
    if (halfEdge) {
      selected.add(halfEdge.origin);
      selected.add(halfEdge.destination);
    }
  }
  if (!selected.size) return mesh.clone();

  const data = mesh.toMeshData();
  const indexById = new Map(data.vertexIds.map((id, index) => [id, index]));
  const positions = [...data.positions];
  const cutIndices = new Map<string, number>();
  const cut = (origin: VertexId, neighbor: VertexId) => {
    const key = `${origin}:${neighbor}`;
    const existing = cutIndices.get(key);
    if (existing !== undefined) return existing;
    const a = mesh.vertices.get(origin)!.position;
    const b = mesh.vertices.get(neighbor)!.position;
    const index = positions.length / 3;
    positions.push(
      a.x + (b.x - a.x) * amount,
      a.y + (b.y - a.y) * amount,
      a.z + (b.z - a.z) * amount,
    );
    cutIndices.set(key, index);
    return index;
  };

  const caps = new Map<VertexId, VertexId[]>();
  const polygons = [...mesh.faces.values()].map((face) => {
    const polygon: number[] = [];
    face.vertices.forEach((vertex, cursor) => {
      if (!selected.has(vertex)) {
        polygon.push(indexById.get(vertex)!);
        return;
      }
      const previous = face.vertices.at(cursor - 1)!;
      const next = face.vertices[(cursor + 1) % face.vertices.length]!;
      polygon.push(cut(vertex, previous), cut(vertex, next));
      const order = caps.get(vertex) ?? [];
      if (!order.includes(previous)) order.push(previous);
      if (!order.includes(next)) order.push(next);
      caps.set(vertex, order);
    });
    return polygon;
  });
  for (const [vertex, neighbors] of caps) {
    if (neighbors.length >= 3)
      polygons.push(
        neighbors.map((neighbor) => cut(vertex, neighbor)).reverse(),
      );
  }
  return EditableMesh.fromPolygons(
    Array.from({ length: positions.length / 3 }, (_, index) =>
      vector(positions, index),
    ),
    polygons,
  );
}

export function loopCut(
  mesh: EditableMesh,
  edgeIds: ReadonlySet<EdgeId>,
  factor = 0.5,
): EditableMesh {
  if (!Number.isFinite(factor) || factor <= 0 || factor >= 1)
    throw new Error("ループカット位置は0より大きく1未満で指定してください。");
  const loop = new Set(collectQuadEdgeRing(mesh, edgeIds));
  if (!loop.size) return mesh.clone();
  const data = mesh.toMeshData();
  const positions = [...data.positions];
  const vertexIndex = new Map(data.vertexIds.map((id, index) => [id, index]));
  const edgeByPair = new Map<string, EdgeId>();
  const midpointByEdge = new Map<EdgeId, number>();
  for (const edge of mesh.edges.values()) {
    const halfEdge = mesh.halfEdges.get(edge.halfEdges[0]!)!;
    edgeByPair.set(edgePairKey(halfEdge.origin, halfEdge.destination), edge.id);
    if (!loop.has(edge.id)) continue;
    const a = mesh.vertices.get(halfEdge.origin)!.position;
    const b = mesh.vertices.get(halfEdge.destination)!.position;
    midpointByEdge.set(edge.id, positions.length / 3);
    positions.push(
      a.x + (b.x - a.x) * factor,
      a.y + (b.y - a.y) * factor,
      a.z + (b.z - a.z) * factor,
    );
  }
  const polygons: number[][] = [];
  for (const face of mesh.faces.values()) {
    const sides = face.vertices.map((vertex, index) =>
      edgeByPair.get(
        edgePairKey(vertex, face.vertices[(index + 1) % face.vertices.length]!),
      ),
    );
    const hits = sides.flatMap((id, index) =>
      id && loop.has(id) ? [index] : [],
    );
    if (
      face.vertices.length !== 4 ||
      hits.length !== 2 ||
      (hits[0]! + 2) % 4 !== hits[1]
    ) {
      polygons.push(face.vertices.map((id) => vertexIndex.get(id)!));
      continue;
    }
    const cursor = hits[0]!;
    const [a, b, c, d] = [0, 1, 2, 3].map(
      (offset) => face.vertices[(cursor + offset) % 4]!,
    );
    const firstMidpoint = midpointByEdge.get(sides[cursor]!)!;
    const oppositeMidpoint = midpointByEdge.get(sides[(cursor + 2) % 4]!)!;
    polygons.push(
      [
        firstMidpoint,
        vertexIndex.get(b)!,
        vertexIndex.get(c)!,
        oppositeMidpoint,
      ],
      [
        vertexIndex.get(a)!,
        firstMidpoint,
        oppositeMidpoint,
        vertexIndex.get(d)!,
      ],
    );
  }
  return EditableMesh.fromPolygons(
    Array.from({ length: positions.length / 3 }, (_, index) =>
      vector(positions, index),
    ),
    polygons,
  );
}

export function splitFace(mesh: EditableMesh, faceId: FaceId): EditableMesh {
  const data = mesh.toMeshData();
  const faceIndex = data.faceIds.indexOf(faceId);
  if (faceIndex < 0) return mesh.clone();
  const face = data.faces[faceIndex]!;
  const positions = [...data.positions];
  const center = face
    .map((index) => vector(data.positions, index))
    .reduce(
      (sum, p) => ({
        x: sum.x + p.x / face.length,
        y: sum.y + p.y / face.length,
        z: sum.z + p.z / face.length,
      }),
      { x: 0, y: 0, z: 0 },
    );
  const centerIndex = positions.length / 3;
  positions.push(center.x, center.y, center.z);
  const polygons = data.faces
    .filter((_, index) => index !== faceIndex)
    .map((face) => [...face]);
  for (let i = 0; i < face.length; i++)
    polygons.push([face[i]!, face[(i + 1) % face.length]!, centerIndex]);
  return EditableMesh.fromPolygons(
    Array.from({ length: positions.length / 3 }, (_, index) =>
      vector(positions, index),
    ),
    polygons,
  );
}

export function knifeFace(
  mesh: EditableMesh,
  faceId: FaceId,
  factor = 0.5,
): EditableMesh {
  if (!Number.isFinite(factor) || factor <= 0 || factor >= 1)
    throw new Error("Knife位置は0より大きく1未満で指定してください。");
  const data = mesh.toMeshData();
  const faceIndex = data.faceIds.indexOf(faceId);
  if (faceIndex < 0) return mesh.clone();
  const target = data.faces[faceIndex]!;
  if (target.length < 4)
    throw new Error("Knifeには4頂点以上のFaceを選択してください。");
  const firstEdge = 0;
  const secondEdge = Math.floor(target.length / 2);
  const positions = [...data.positions];
  const cutIndices = [firstEdge, secondEdge].map((edgeIndex) => {
    const from = target[edgeIndex]!;
    const to = target[(edgeIndex + 1) % target.length]!;
    const fromPoint = vector(data.positions, from);
    const toPoint = vector(data.positions, to);
    const index = positions.length / 3;
    positions.push(
      fromPoint.x + (toPoint.x - fromPoint.x) * factor,
      fromPoint.y + (toPoint.y - fromPoint.y) * factor,
      fromPoint.z + (toPoint.z - fromPoint.z) * factor,
    );
    return { index, from, to };
  });
  const polygons: number[][] = [];
  data.faces.forEach((face, index) => {
    const expanded: number[] = [];
    face.forEach((from, cursor) => {
      const to = face[(cursor + 1) % face.length]!;
      expanded.push(from);
      const cut = cutIndices.find(
        (candidate) =>
          (candidate.from === from && candidate.to === to) ||
          (candidate.from === to && candidate.to === from),
      );
      if (cut) expanded.push(cut.index);
    });
    if (index !== faceIndex) {
      polygons.push(expanded);
      return;
    }
    const first = expanded.indexOf(cutIndices[0]!.index);
    const second = expanded.indexOf(cutIndices[1]!.index);
    polygons.push(
      cyclicSlice(expanded, first, second),
      cyclicSlice(expanded, second, first),
    );
  });
  return EditableMesh.fromPolygons(
    Array.from({ length: positions.length / 3 }, (_, index) =>
      vector(positions, index),
    ),
    polygons,
  );
}

function cyclicSlice(values: readonly number[], from: number, to: number) {
  const result = [values[from]!];
  for (
    let cursor = (from + 1) % values.length;
    cursor !== to;
    cursor = (cursor + 1) % values.length
  )
    result.push(values[cursor]!);
  result.push(values[to]!);
  return result;
}

export function splitEdge(mesh: EditableMesh, edgeId: EdgeId): EditableMesh {
  const data = mesh.toMeshData();
  const edge = data.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) return mesh.clone();
  const [a, b] = edge.vertices;
  const pa = vector(data.positions, a),
    pb = vector(data.positions, b);
  const positions = [
    ...data.positions,
    (pa.x + pb.x) / 2,
    (pa.y + pb.y) / 2,
    (pa.z + pb.z) / 2,
  ];
  const midpoint = positions.length / 3 - 1;
  const polygons = data.faces.map((face) => {
    const result: number[] = [];
    for (let i = 0; i < face.length; i++) {
      const current = face[i]!,
        next = face[(i + 1) % face.length]!;
      result.push(current);
      if ((current === a && next === b) || (current === b && next === a))
        result.push(midpoint);
    }
    return result;
  });
  return EditableMesh.fromPolygons(
    Array.from({ length: positions.length / 3 }, (_, index) =>
      vector(positions, index),
    ),
    polygons,
  );
}

export function flipFaces(
  mesh: EditableMesh,
  faceIds: ReadonlySet<FaceId>,
): EditableMesh {
  const data = mesh.toMeshData();
  const polygons = data.faces.map((face, index) =>
    faceIds.has(data.faceIds[index]!) ? [...face].reverse() : [...face],
  );
  return EditableMesh.fromPolygons(
    Array.from({ length: data.positions.length / 3 }, (_, index) =>
      vector(data.positions, index),
    ),
    polygons,
  );
}

export function mergeVertices(
  mesh: EditableMesh,
  keepId: VertexId,
  removeId: VertexId,
): EditableMesh {
  const data = mesh.toMeshData();
  const keep = data.vertexIds.indexOf(keepId),
    remove = data.vertexIds.indexOf(removeId);
  if (keep < 0 || remove < 0 || keep === remove) return mesh.clone();
  const positions: number[] = [];
  const remap = new Map<number, number>();
  for (let index = 0; index < data.vertexIds.length; index++) {
    if (index === remove) continue;
    remap.set(index, positions.length / 3);
    positions.push(...data.positions.slice(index * 3, index * 3 + 3));
  }
  remap.set(remove, remap.get(keep)!);
  const polygons = data.faces
    .map((face) => {
      const mapped = face.map((index) => remap.get(index)!);
      const compact = mapped.filter(
        (value, index) => index === 0 || value !== mapped[index - 1],
      );
      if (compact.length > 1 && compact[0] === compact[compact.length - 1])
        compact.pop();
      return compact;
    })
    .filter((face) => new Set(face).size >= 3);
  return EditableMesh.fromPolygons(
    Array.from({ length: positions.length / 3 }, (_, index) =>
      vector(positions, index),
    ),
    polygons,
  );
}

export function createFace(
  mesh: EditableMesh,
  vertexIds: readonly VertexId[],
): EditableMesh {
  if (vertexIds.length < 3 || new Set(vertexIds).size !== vertexIds.length)
    throw new Error("Face creation requires at least three distinct vertices");
  const data = mesh.toMeshData();
  const polygon = vertexIds.map((id) => {
    const index = data.vertexIds.indexOf(id);
    if (index < 0) throw new Error(`Vertex not found: ${id}`);
    return index;
  });
  return EditableMesh.fromPolygons(
    Array.from({ length: data.positions.length / 3 }, (_, index) =>
      vector(data.positions, index),
    ),
    [...data.faces, polygon],
  );
}
