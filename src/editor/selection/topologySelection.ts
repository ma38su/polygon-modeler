import type { EdgeId } from "../document/types";
import type { EditableMesh } from "../mesh/EditableMesh";
import type { SelectionItem } from "./SelectionManager";

export type AdjacencySelectionOperation = "grow" | "shrink" | "connected";

export function changeSelectionByAdjacency(
  mesh: EditableMesh,
  selectedIds: readonly SelectionItem["elementId"][],
  operation: AdjacencySelectionOperation,
): SelectionItem["elementId"][] {
  const neighbors = buildAdjacency(mesh);
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

export function selectQuadEdgeLoop(
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

function buildAdjacency(mesh: EditableMesh): Map<string, Set<string>> {
  const neighbors = new Map<string, Set<string>>();
  const connect = (a: string, b: string) => {
    if (a === b) return;
    (neighbors.get(a) ?? neighbors.set(a, new Set()).get(a)!).add(b);
    (neighbors.get(b) ?? neighbors.set(b, new Set()).get(b)!).add(a);
  };
  for (const edge of mesh.edges.values()) {
    const halfEdge = mesh.halfEdges.get(edge.halfEdges[0]!)!;
    connect(halfEdge.origin, halfEdge.destination);
  }
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
  const faces = [...mesh.faces.values()];
  for (let i = 0; i < faces.length; i++)
    for (let j = i + 1; j < faces.length; j++)
      if (
        faces[i]!.vertices.filter((id) => faces[j]!.vertices.includes(id))
          .length >= 2
      )
        connect(faces[i]!.id, faces[j]!.id);
  return neighbors;
}

const pairKey = (a: string, b: string) => [a, b].sort().join(":");
