import type { EdgeId, FaceId, VertexId } from "../document/types";
import type { EditableMesh } from "./EditableMesh";

export function collectEdgeLoop(
  mesh: EditableMesh,
  initial: ReadonlySet<EdgeId>,
): EdgeId[] {
  const topology = edgeTopology(mesh);
  const selected = new Set<EdgeId>();
  for (const seed of initial) {
    const edge = mesh.edges.get(seed);
    if (!edge) continue;
    selected.add(seed);
    const halfEdge = mesh.halfEdges.get(edge.halfEdges[0]!)!;
    walkLoopDirection(seed, halfEdge.origin, topology, selected);
    walkLoopDirection(seed, halfEdge.destination, topology, selected);
  }
  return [...selected];
}

export function collectQuadEdgeRing(
  mesh: EditableMesh,
  initial: ReadonlySet<EdgeId>,
): EdgeId[] {
  const selected = new Set<EdgeId>();
  const edgeByPair = new Map<string, EdgeId>();
  for (const edge of mesh.edges.values()) {
    const halfEdge = mesh.halfEdges.get(edge.halfEdges[0]!)!;
    edgeByPair.set(edgePairKey(halfEdge.origin, halfEdge.destination), edge.id);
  }
  const queue = [...initial].filter((id) => mesh.edges.has(id));
  queue.forEach((id) => selected.add(id));
  while (queue.length) {
    const edge = mesh.edges.get(queue.shift()!)!;
    for (const halfEdgeId of edge.halfEdges) {
      const halfEdge = mesh.halfEdges.get(halfEdgeId)!;
      const face = mesh.faces.get(halfEdge.face)!;
      if (face.vertices.length !== 4) continue;
      const cursor = directedEdgeIndex(
        face.vertices,
        halfEdge.origin,
        halfEdge.destination,
      );
      if (cursor < 0) continue;
      const opposite = edgeByPair.get(
        edgePairKey(
          face.vertices[(cursor + 2) % 4]!,
          face.vertices[(cursor + 3) % 4]!,
        ),
      );
      if (opposite && !selected.has(opposite)) {
        selected.add(opposite);
        queue.push(opposite);
      }
    }
  }
  return [...selected];
}

/** @deprecated Use collectQuadEdgeRing for opposite-edge traversal. */
export const collectQuadEdgeLoop = collectQuadEdgeRing;

function walkLoopDirection(
  seed: EdgeId,
  initialVertex: VertexId,
  topology: ReturnType<typeof edgeTopology>,
  selected: Set<EdgeId>,
): void {
  let edge = seed;
  let vertex = initialVertex;
  while (true) {
    const currentFaces = topology.facesByEdge.get(edge) ?? new Set<FaceId>();
    const candidates = (topology.edgesByVertex.get(vertex) ?? []).filter(
      (candidate) =>
        candidate !== edge &&
        ![...(topology.facesByEdge.get(candidate) ?? [])].some((face) =>
          currentFaces.has(face),
        ),
    );
    if (candidates.length !== 1 || selected.has(candidates[0]!)) return;
    const next = candidates[0]!;
    selected.add(next);
    const endpoints = topology.verticesByEdge.get(next)!;
    vertex = endpoints[0] === vertex ? endpoints[1] : endpoints[0];
    edge = next;
  }
}

function edgeTopology(mesh: EditableMesh) {
  const edgesByVertex = new Map<VertexId, EdgeId[]>();
  const verticesByEdge = new Map<EdgeId, readonly [VertexId, VertexId]>();
  const facesByEdge = new Map<EdgeId, Set<FaceId>>();
  for (const edge of mesh.edges.values()) {
    const first = mesh.halfEdges.get(edge.halfEdges[0]!)!;
    const vertices = [first.origin, first.destination] as const;
    verticesByEdge.set(edge.id, vertices);
    for (const vertex of vertices)
      edgesByVertex.set(vertex, [
        ...(edgesByVertex.get(vertex) ?? []),
        edge.id,
      ]);
    facesByEdge.set(
      edge.id,
      new Set(
        edge.halfEdges
          .map((id) => mesh.halfEdges.get(id)!.face)
          .filter((face) => mesh.faces.get(face)?.vertices.length === 4),
      ),
    );
  }
  return { edgesByVertex, verticesByEdge, facesByEdge };
}

function directedEdgeIndex(
  vertices: readonly VertexId[],
  origin: VertexId,
  destination: VertexId,
): number {
  return vertices.findIndex(
    (vertex, index) =>
      vertex === origin &&
      vertices[(index + 1) % vertices.length] === destination,
  );
}

export const edgePairKey = (a: string, b: string) => [a, b].sort().join(":");
