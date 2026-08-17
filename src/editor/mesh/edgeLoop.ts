import type { EdgeId, VertexId } from "../document/types";
import type { EditableMesh } from "./EditableMesh";

/** Continue straight through quad corners, stopping whenever continuation is ambiguous. */
export function collectEdgeLoop(mesh: EditableMesh, initial: ReadonlySet<EdgeId>): EdgeId[] {
  const topology = buildTopology(mesh);
  const selected = new Set<EdgeId>();
  for (const seed of initial) {
    const endpoints = topology.verticesByEdge.get(seed);
    if (!endpoints) continue;
    selected.add(seed);
    walkLoopDirection(seed, endpoints[0], topology, selected);
    walkLoopDirection(seed, endpoints[1], topology, selected);
  }
  return [...selected];
}

export function collectQuadEdgeRing(mesh: EditableMesh, initial: ReadonlySet<EdgeId>): EdgeId[] {
  const selected = new Set<EdgeId>();
  const edgeByPair = new Map<string, EdgeId>();
  for (const edge of mesh.edges.values()) {
    const halfEdge = mesh.halfEdges.get(edge.halfEdges[0]!)!;
    edgeByPair.set(edgePairKey(halfEdge.origin, halfEdge.destination), edge.id);
  }
  const queue = [...initial].filter((id) => mesh.edges.has(id));
  queue.forEach((id) => selected.add(id));
  for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
    const edge = mesh.edges.get(queue[queueIndex]!)!;
    for (const halfEdgeId of edge.halfEdges) {
      const halfEdge = mesh.halfEdges.get(halfEdgeId)!;
      const face = mesh.faces.get(halfEdge.face)!;
      if (face.vertices.length !== 4) continue;
      const cursor = directedEdgeIndex(face.vertices, halfEdge.origin, halfEdge.destination);
      if (cursor < 0) continue;
      const opposite = edgeByPair.get(edgePairKey(
        face.vertices[(cursor + 2) % 4]!, face.vertices[(cursor + 3) % 4]!,
      ));
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

interface EdgeTopology {
  readonly edgesByVertex: ReadonlyMap<VertexId, readonly EdgeId[]>;
  readonly verticesByEdge: ReadonlyMap<EdgeId, readonly [VertexId, VertexId]>;
  readonly quadNeighbors: ReadonlyMap<EdgeId, ReadonlySet<EdgeId>>;
}

function walkLoopDirection(
  seed: EdgeId,
  initialVertex: VertexId,
  topology: EdgeTopology,
  selected: Set<EdgeId>,
): void {
  let edge = seed;
  let vertex = initialVertex;
  while (true) {
    const adjacentInQuads = topology.quadNeighbors.get(edge);
    // With no quad on the incoming edge there is no topological definition of
    // an opposite continuation (an n-gon outline alone is not an edge loop).
    if (!adjacentInQuads) return;
    const candidates = (topology.edgesByVertex.get(vertex) ?? []).filter(
      (candidate) => candidate !== edge && !adjacentInQuads?.has(candidate),
    );
    // Poles and mixed topology can offer multiple plausible paths. Stopping
    // here avoids an arbitrary result based on map insertion order or angles.
    if (candidates.length !== 1) return;
    const next = candidates[0]!;
    if (selected.has(next)) return;
    selected.add(next);
    const endpoints = topology.verticesByEdge.get(next)!;
    vertex = endpoints[0] === vertex ? endpoints[1] : endpoints[0];
    edge = next;
  }
}

function buildTopology(mesh: EditableMesh): EdgeTopology {
  const edgesByVertex = new Map<VertexId, EdgeId[]>();
  const verticesByEdge = new Map<EdgeId, readonly [VertexId, VertexId]>();
  const edgeByPair = new Map<string, EdgeId>();
  const quadNeighbors = new Map<EdgeId, Set<EdgeId>>();
  for (const edge of mesh.edges.values()) {
    const first = mesh.halfEdges.get(edge.halfEdges[0]!)!;
    const vertices = [first.origin, first.destination] as const;
    verticesByEdge.set(edge.id, vertices);
    edgeByPair.set(edgePairKey(...vertices), edge.id);
    for (const vertex of vertices) {
      const incident = edgesByVertex.get(vertex) ?? [];
      incident.push(edge.id);
      edgesByVertex.set(vertex, incident);
    }
  }
  for (const face of mesh.faces.values()) {
    if (face.vertices.length !== 4) continue;
    const faceEdges = face.vertices.map((vertex, index) => edgeByPair.get(
      edgePairKey(vertex, face.vertices[(index + 1) % face.vertices.length]!),
    )!);
    for (let index = 0; index < faceEdges.length; index++) {
      const edge = faceEdges[index]!;
      const neighbors = quadNeighbors.get(edge) ?? new Set<EdgeId>();
      neighbors.add(faceEdges[(index + 1) % 4]!);
      neighbors.add(faceEdges[(index + 3) % 4]!);
      quadNeighbors.set(edge, neighbors);
    }
  }
  return { edgesByVertex, verticesByEdge, quadNeighbors };
}

function directedEdgeIndex(vertices: readonly VertexId[], origin: VertexId, destination: VertexId): number {
  return vertices.findIndex((vertex, index) =>
    vertex === origin && vertices[(index + 1) % vertices.length] === destination,
  );
}

export const edgePairKey = (a: string, b: string) => [a, b].sort().join(":");
