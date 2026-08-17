import type { EdgeId, FaceId, VertexId } from "../document/types";
import type { EditableMesh } from "../mesh/EditableMesh";
import type { SelectionItem } from "./SelectionManager";
export {
  collectEdgeLoop as selectEdgeLoop,
  collectQuadEdgeRing as selectEdgeRing,
} from "../mesh/edgeLoop";

export type AdjacencySelectionOperation = "grow" | "shrink" | "connected";

export function changeSelectionByAdjacency(
  mesh: EditableMesh,
  selectedIds: readonly SelectionItem["elementId"][],
  operation: AdjacencySelectionOperation,
): SelectionItem["elementId"][] {
  const neighbors = buildAdjacency(mesh, selectedIds);
  const selected = new Set(selectedIds as readonly string[]);
  if (operation === "grow") {
    for (const id of [...selected])
      for (const neighbor of neighbors.get(id) ?? []) selected.add(neighbor);
  } else if (operation === "shrink") {
    const before = new Set(selected);
    for (const id of before)
      if ([...(neighbors.get(id) ?? [])].some((next) => !before.has(next)))
        selected.delete(id);
  } else {
    const queue = [...selected];
    while (queue.length)
      for (const neighbor of neighbors.get(queue.shift()!) ?? [])
        if (!selected.has(neighbor)) {
          selected.add(neighbor);
          queue.push(neighbor);
        }
  }
  return [...selected] as SelectionItem["elementId"][];
}

function buildAdjacency(
  mesh: EditableMesh,
  selectedIds: readonly SelectionItem["elementId"][],
): Map<string, Set<string>> {
  const neighbors = new Map<string, Set<string>>();
  const includeVertices = selectedIds.some((id) =>
    mesh.vertices.has(id as VertexId),
  );
  const includeEdges = selectedIds.some((id) => mesh.edges.has(id as EdgeId));
  const includeFaces = selectedIds.some((id) => mesh.faces.has(id as FaceId));
  const connect = (a: string, b: string) => {
    if (a === b) return;
    (neighbors.get(a) ?? neighbors.set(a, new Set()).get(a)!).add(b);
    (neighbors.get(b) ?? neighbors.set(b, new Set()).get(b)!).add(a);
  };
  if (includeVertices)
    for (const edge of mesh.edges.values()) {
      const halfEdge = mesh.halfEdges.get(edge.halfEdges[0]!)!;
      connect(halfEdge.origin, halfEdge.destination);
    }
  if (includeEdges) {
    const edgesByVertex = new Map<string, EdgeId[]>();
    for (const edge of mesh.edges.values()) {
      const halfEdge = mesh.halfEdges.get(edge.halfEdges[0]!)!;
      for (const vertex of [halfEdge.origin, halfEdge.destination]) {
        const incident = edgesByVertex.get(vertex) ?? [];
        incident.push(edge.id);
        edgesByVertex.set(vertex, incident);
      }
    }
    for (const incident of edgesByVertex.values())
      for (let i = 0; i < incident.length; i++)
        for (let j = i + 1; j < incident.length; j++)
          connect(incident[i]!, incident[j]!);
  }
  if (includeFaces)
    for (const edge of mesh.edges.values()) {
      const faces = edge.halfEdges.map((id) => mesh.halfEdges.get(id)!.face);
      if (faces.length === 2) connect(faces[0]!, faces[1]!);
    }
  return neighbors;
}
