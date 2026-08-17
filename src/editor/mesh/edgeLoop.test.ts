import { describe, expect, it } from "vitest";
import type { EdgeId } from "../document/types";
import { createCylinderMesh } from "./primitives/cylinder";
import { createPlaneMesh } from "./primitives/plane";
import { EditableMesh } from "./EditableMesh";
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

  it("stops at the boundary of a single quad", () => {
    const mesh = createPlaneMesh();
    const boundary = [...mesh.edges.keys()][0]!;
    expect(collectEdgeLoop(mesh, new Set([boundary]))).toEqual([boundary]);
  });

  it("does not invent a continuation around an n-gon", () => {
    const mesh = EditableMesh.fromPolygons(
      [
        { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
        { x: 1.5, y: 1, z: 0 }, { x: 0.5, y: 2, z: 0 },
        { x: -0.5, y: 1, z: 0 },
      ],
      [[0, 1, 2, 3, 4]],
    );
    const seed = [...mesh.edges.keys()][0]!;
    expect(collectEdgeLoop(mesh, new Set([seed]))).toEqual([seed]);
    expect(collectQuadEdgeRing(mesh, new Set([seed]))).toEqual([seed]);
  });

  it("returns all valid seeds while stopping independently at ambiguity", () => {
    const mesh = createCylinderMesh(1, 2, 3);
    const verticals = [...mesh.edges.values()]
      .filter((edge) => {
        const halfEdge = mesh.halfEdges.get(edge.halfEdges[0]!)!;
        return mesh.vertices.get(halfEdge.origin)!.position.y !==
          mesh.vertices.get(halfEdge.destination)!.position.y;
      })
      .map((edge) => edge.id);
    expect(new Set(collectEdgeLoop(mesh, new Set(verticals)))).toEqual(new Set(verticals));
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
