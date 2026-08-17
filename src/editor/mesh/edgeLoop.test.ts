import { describe, expect, it } from "vitest";
import type { EdgeId } from "../document/types";
import { createCylinderMesh } from "./primitives/cylinder";
import { collectEdgeLoop, collectQuadEdgeRing } from "./edgeLoop";

describe("edge loop and ring traversal", () => {
  it("follows a loop through vertices while ignoring an adjacent n-gon cap", () => {
    const mesh = createCylinderMesh(1, 2, 8);
    const horizontal = findEdge(mesh, (a, b) => a.y === b.y);
    expect(collectEdgeLoop(mesh, new Set([horizontal]))).toHaveLength(8);
  });

  it("follows opposite quad edges as a ring", () => {
    const mesh = createCylinderMesh(1, 2, 8);
    const vertical = findEdge(mesh, (a, b) => a.y !== b.y);
    expect(collectQuadEdgeRing(mesh, new Set([vertical]))).toHaveLength(8);
  });

  it("stops a loop at a pole instead of choosing an ambiguous branch", () => {
    const mesh = createCylinderMesh(1, 2, 3);
    const vertical = findEdge(mesh, (a, b) => a.y !== b.y);
    expect(collectEdgeLoop(mesh, new Set([vertical]))).toEqual([vertical]);
  });
});

function findEdge(
  mesh: ReturnType<typeof createCylinderMesh>,
  predicate: (
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
  ) => boolean,
): EdgeId {
  for (const edge of mesh.edges.values()) {
    const halfEdge = mesh.halfEdges.get(edge.halfEdges[0]!)!;
    const a = mesh.vertices.get(halfEdge.origin)!.position;
    const b = mesh.vertices.get(halfEdge.destination)!.position;
    if (predicate(a, b)) return edge.id;
  }
  throw new Error("matching edge not found");
}
