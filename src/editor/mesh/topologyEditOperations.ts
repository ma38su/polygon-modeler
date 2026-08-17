import type { EdgeId, FaceId, VertexId } from "../document/types";
import { EditableMesh } from "./EditableMesh";

type IndexedMesh = ReturnType<EditableMesh["toMeshData"]>;

const rebuild = (
  data: IndexedMesh,
  faces: readonly (readonly number[])[],
): EditableMesh => {
  const used = new Set(faces.flat());
  const retained = [...used].sort((a, b) => a - b);
  const remap = new Map(retained.map((value, index) => [value, index]));
  return EditableMesh.fromPolygons(
    retained.map((index) => ({
      x: data.positions[index * 3]!,
      y: data.positions[index * 3 + 1]!,
      z: data.positions[index * 3 + 2]!,
    })),
    faces.map((face) => face.map((index) => remap.get(index)!)),
  );
};

const faceIndex = (data: IndexedMesh, id: FaceId) => data.faceIds.indexOf(id);

/** Removes selected faces, leaving their boundary as an open surface. */
export function dissolveFaces(
  mesh: EditableMesh,
  faceIds: ReadonlySet<FaceId>,
): EditableMesh {
  if (!faceIds.size) return mesh.clone();
  const data = mesh.toMeshData();
  return rebuild(
    data,
    data.faces.filter((_, index) => !faceIds.has(data.faceIds[index]!)),
  );
}

/** Dissolves interior edges by merging their two incident polygons. */
export function dissolveEdges(
  mesh: EditableMesh,
  edgeIds: ReadonlySet<EdgeId>,
): EditableMesh {
  const endpointKeys = [...edgeIds].flatMap((edgeId) => {
    const edge = mesh.edges.get(edgeId);
    const halfEdge = edge && mesh.halfEdges.get(edge.halfEdges[0]!);
    return halfEdge
      ? [positionPairKey(mesh, halfEdge.origin, halfEdge.destination)]
      : [];
  });
  let result = mesh.clone();
  for (const key of endpointKeys) {
    const edge = [...result.edges.values()].find((candidate) => {
      const halfEdge = result.halfEdges.get(candidate.halfEdges[0]!)!;
      return (
        positionPairKey(result, halfEdge.origin, halfEdge.destination) === key
      );
    });
    if (edge) result = dissolveOneEdge(result, edge.id);
  }
  return result;
}

const positionPairKey = (
  mesh: EditableMesh,
  first: VertexId,
  second: VertexId,
) => {
  const encode = (id: VertexId) => {
    const point = mesh.vertices.get(id)!.position;
    return `${point.x},${point.y},${point.z}`;
  };
  return [encode(first), encode(second)].sort().join("|");
};

function dissolveOneEdge(mesh: EditableMesh, edgeId: EdgeId): EditableMesh {
  const edge = mesh.edges.get(edgeId);
  if (!edge) return mesh.clone();
  if (edge.halfEdges.length !== 2)
    throw new Error("境界辺は面を保持したままDissolveできません。");
  const a = mesh.halfEdges.get(edge.halfEdges[0]!)!;
  const b = mesh.halfEdges.get(edge.halfEdges[1]!)!;
  const data = mesh.toMeshData();
  const ai = faceIndex(data, a.face);
  const bi = faceIndex(data, b.face);
  const af = data.faces[ai]!;
  const bf = data.faces[bi]!;
  const byVertexId = new Map(data.vertexIds.map((id, index) => [id, index]));
  const av = byVertexId.get(a.origin)!;
  const bv = byVertexId.get(a.destination)!;
  const path = (face: readonly number[], from: number, to: number) => {
    const output = [from];
    let cursor = face.indexOf(from);
    for (let guard = 0; guard < face.length; guard += 1) {
      cursor = (cursor + 1) % face.length;
      output.push(face[cursor]!);
      if (face[cursor] === to) return output;
    }
    throw new Error("Dissolve対象の面境界を追跡できません。");
  };
  // Avoid the dissolved a->b and b->a sides by walking the opposite paths.
  const merged = [...path(af, bv, av), ...path(bf, av, bv).slice(1, -1)];
  if (new Set(merged).size !== merged.length)
    throw new Error("この辺をDissolveすると自己交差面が生じます。");
  return rebuild(data, [
    ...data.faces.filter((_, index) => index !== ai && index !== bi),
    merged,
  ]);
}

/** Dissolves vertices by removing them from their incident polygon boundaries. */
export function dissolveVertices(
  mesh: EditableMesh,
  vertexIds: ReadonlySet<VertexId>,
): EditableMesh {
  if (!vertexIds.size) return mesh.clone();
  const data = mesh.toMeshData();
  const selectedIndices = new Set(
    data.vertexIds.flatMap((id, index) => (vertexIds.has(id) ? [index] : [])),
  );
  const faces = data.faces.map((face) =>
    face.filter((index) => !selectedIndices.has(index)),
  );
  if (faces.some((face) => face.length < 3))
    throw new Error("Dissolve後に3頂点未満となる面があります。");
  return rebuild(data, faces);
}

const boundaryHalfEdges = (mesh: EditableMesh, edgeIds: ReadonlySet<EdgeId>) =>
  [...edgeIds].map((id) => {
    const edge = mesh.edges.get(id);
    if (!edge || edge.halfEdges.length !== 1)
      throw new Error("完全な境界辺だけを選択してください。");
    return mesh.halfEdges.get(edge.halfEdges[0]!)!;
  });

function orderedBoundary(
  mesh: EditableMesh,
  edgeIds: ReadonlySet<EdgeId>,
): VertexId[] {
  const halfEdges = boundaryHalfEdges(mesh, edgeIds);
  if (halfEdges.length < 3) throw new Error("境界には3辺以上が必要です。");
  const nextByOrigin = new Map(
    halfEdges.map((halfEdge) => [halfEdge.origin, halfEdge]),
  );
  if (nextByOrigin.size !== halfEdges.length)
    throw new Error("選択した境界が単一ループではありません。");
  const first = halfEdges[0]!;
  const vertices: VertexId[] = [first.origin];
  let current = first;
  while (current.destination !== first.origin) {
    vertices.push(current.destination);
    const next = nextByOrigin.get(current.destination);
    if (!next || vertices.length > halfEdges.length)
      throw new Error("選択した境界が閉じた単一ループではありません。");
    current = next;
  }
  if (vertices.length !== halfEdges.length)
    throw new Error("選択した境界に複数ループが含まれています。");
  return vertices;
}

/** Caps one complete boundary loop with an n-gon. */
export function fillBoundary(
  mesh: EditableMesh,
  edgeIds: ReadonlySet<EdgeId>,
): EditableMesh {
  const loop = orderedBoundary(mesh, edgeIds).reverse();
  const data = mesh.toMeshData();
  const indexById = new Map(data.vertexIds.map((id, index) => [id, index]));
  return rebuild(data, [...data.faces, loop.map((id) => indexById.get(id)!)]);
}

/** Bridges two complete boundary loops with quads. Loops must have equal counts. */
export function bridgeEdgeLoops(
  mesh: EditableMesh,
  firstEdges: ReadonlySet<EdgeId>,
  secondEdges: ReadonlySet<EdgeId>,
): EditableMesh {
  const first = orderedBoundary(mesh, firstEdges);
  let second = orderedBoundary(mesh, secondEdges).reverse();
  if (first.length !== second.length)
    throw new Error("Bridgeする境界ループの辺数を一致させてください。");
  if (first.some((id) => second.includes(id)))
    throw new Error("Bridgeする境界ループは頂点を共有できません。");
  // Align the second loop at the nearest vertex to avoid an arbitrary twist.
  const anchor = mesh.vertices.get(first[0]!)!.position;
  const nearest = second.reduce(
    (best, id, index) => {
      const point = mesh.vertices.get(id)!.position;
      const distance =
        (point.x - anchor.x) ** 2 +
        (point.y - anchor.y) ** 2 +
        (point.z - anchor.z) ** 2;
      return distance < best.distance ? { index, distance } : best;
    },
    { index: 0, distance: Number.POSITIVE_INFINITY },
  ).index;
  second = [...second.slice(nearest), ...second.slice(0, nearest)];
  const data = mesh.toMeshData();
  const indexById = new Map(data.vertexIds.map((id, index) => [id, index]));
  const quads = first.map((a, index) => [
    indexById.get(a)!,
    indexById.get(second[index]!)!,
    indexById.get(second[(index + 1) % second.length]!)!,
    indexById.get(first[(index + 1) % first.length]!)!,
  ]);
  return rebuild(data, [...data.faces, ...quads]);
}
