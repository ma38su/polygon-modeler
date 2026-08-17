import { describe, expect, it } from "vitest";
import type { EdgeId } from "../document/types";
import { EditableMesh } from "./EditableMesh";
import { createBoxMesh } from "./primitives/box";
import { createPlaneMesh } from "./primitives/plane";
import {
  bridgeEdgeLoops,
  dissolveEdges,
  dissolveFaces,
  dissolveVertices,
  fillBoundary,
} from "./topologyEditOperations";
import { validateMesh } from "./validateMesh";

describe("topology edit operations", () => {
  it("dissolves a vertex while preserving the surrounding face", () => {
    const mesh = EditableMesh.fromPolygons(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 2, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      [[0, 1, 2, 3, 4]],
    );
    const result = dissolveVertices(
      mesh,
      new Set([[...mesh.vertices.keys()][1]!]),
    );
    expect(result.vertices.size).toBe(4);
    expect([...result.faces.values()][0]!.vertices).toHaveLength(4);
    expect(validateMesh(result).valid).toBe(true);
  });

  it("merges the faces on both sides of an interior edge", () => {
    const mesh = EditableMesh.fromPolygons(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      [
        [0, 1, 2],
        [0, 2, 3],
      ],
    );
    const interior = [...mesh.edges.values()].find(
      (edge) => edge.halfEdges.length === 2,
    )!;
    const result = dissolveEdges(mesh, new Set([interior.id]));
    expect(result.faces.size).toBe(1);
    expect([...result.faces.values()][0]!.vertices).toHaveLength(4);
    expect(validateMesh(result).valid).toBe(true);
  });

  it("dissolves faces and leaves a valid open surface", () => {
    const mesh = createBoxMesh();
    const result = dissolveFaces(mesh, new Set([[...mesh.faces.keys()][0]!]));
    expect(result.faces.size).toBe(5);
    expect(validateMesh(result).valid).toBe(true);
  });

  it("fills a complete boundary with an oppositely wound face", () => {
    const mesh = createPlaneMesh();
    const result = fillBoundary(mesh, new Set(mesh.edges.keys()));
    expect(result.faces.size).toBe(2);
    expect(
      [...result.edges.values()].every((edge) => edge.halfEdges.length === 2),
    ).toBe(true);
    expect(validateMesh(result).valid).toBe(true);
  });

  it("bridges equal disconnected boundary loops without twisting", () => {
    const mesh = EditableMesh.fromPolygons(
      [
        { x: -1, y: -1, z: 0 },
        { x: 1, y: -1, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: -1, y: 1, z: 0 },
        { x: -1, y: -1, z: 2 },
        { x: 1, y: -1, z: 2 },
        { x: 1, y: 1, z: 2 },
        { x: -1, y: 1, z: 2 },
      ],
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
      ],
    );
    const lower = new Set<EdgeId>();
    const upper = new Set<EdgeId>();
    for (const edge of mesh.edges.values()) {
      const halfEdge = mesh.halfEdges.get(edge.halfEdges[0]!)!;
      const z = mesh.vertices.get(halfEdge.origin)!.position.z;
      (z === 0 ? lower : upper).add(edge.id);
    }
    const result = bridgeEdgeLoops(mesh, lower, upper);
    expect(result.faces.size).toBe(6);
    expect(validateMesh(result).valid).toBe(true);
  });

  it("rejects incomplete fill and mismatched bridge loops", () => {
    const plane = createPlaneMesh();
    expect(() =>
      fillBoundary(plane, new Set([[...plane.edges.keys()][0]!])),
    ).toThrow();
    const triangleAndQuad = EditableMesh.fromPolygons(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 2 },
        { x: 1, y: 0, z: 2 },
        { x: 1, y: 1, z: 2 },
        { x: 0, y: 1, z: 2 },
      ],
      [
        [0, 1, 2],
        [3, 4, 5, 6],
      ],
    );
    const loops = [...triangleAndQuad.faces.values()].map(
      (face) =>
        new Set(
          [...triangleAndQuad.edges.values()]
            .filter((edge) => {
              const halfEdge = triangleAndQuad.halfEdges.get(
                edge.halfEdges[0]!,
              )!;
              return halfEdge.face === face.id;
            })
            .map((edge) => edge.id),
        ),
    );
    expect(() =>
      bridgeEdgeLoops(triangleAndQuad, loops[0]!, loops[1]!),
    ).toThrow();
  });
});
