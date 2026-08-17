import type { EdgeId } from "../document/types";
import type { EditableMesh } from "./EditableMesh";

export function collectQuadEdgeLoop(
  mesh: EditableMesh,
  initial: ReadonlySet<EdgeId>,
): EdgeId[] {
  const selected = new Set(initial);
  const edgeByPair = new Map<string, EdgeId>();
  for (const edge of mesh.edges.values()) {
    const halfEdge = mesh.halfEdges.get(edge.halfEdges[0]!)!;
    edgeByPair.set(pairKey(halfEdge.origin, halfEdge.destination), edge.id);
  }
  const queue = [...selected];
  while (queue.length) {
    const edge = mesh.edges.get(queue.shift()!);
    if (!edge) continue;
    for (const halfEdgeId of edge.halfEdges) {
      const halfEdge = mesh.halfEdges.get(halfEdgeId)!;
      const face = mesh.faces.get(halfEdge.face)!;
      if (face.vertices.length !== 4) continue;
      const cursor = face.vertices.findIndex(
        (vertex, index) =>
          vertex === halfEdge.origin &&
          face.vertices[(index + 1) % 4] === halfEdge.destination,
      );
      if (cursor < 0) continue;
      const opposite = edgeByPair.get(
        pairKey(
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

export const edgePairKey = (a: string, b: string) => [a, b].sort().join(":");
const pairKey = edgePairKey;
