import { describe, expect, it } from "vitest";
import { createPlaneMesh } from "./primitives/plane";
import { projectUv, transformUv } from "./uvOperations";

describe("UV operations", () => {
  it("projects a face into the 0..1 UV tile", () => {
    const mesh = createPlaneMesh();
    const faceIds = new Set(mesh.faces.keys());
    const projected = projectUv(mesh, faceIds, "xz");
    const uvs = [...projected.halfEdges.values()].map((corner) => corner.uv!);
    expect(new Set(uvs.map(({ u }) => u))).toEqual(new Set([0, 1]));
    expect(new Set(uvs.map(({ v }) => v))).toEqual(new Set([0, 1]));
    expect([...mesh.halfEdges.values()].every((corner) => !corner.uv)).toBe(
      true,
    );
  });

  it("translates, rotates and scales projected UVs without changing geometry", () => {
    const source = createPlaneMesh();
    const faceIds = new Set(source.faces.keys());
    const projected = projectUv(source, faceIds, "xz");
    const transformed = transformUv(projected, faceIds, {
      translation: { u: 1, v: 2 },
      rotation: Math.PI / 2,
      scale: { u: 2, v: 2 },
      pivot: { u: 0, v: 0 },
    });
    const first = [...transformed.halfEdges.values()][0]!.uv!;
    const before = [...projected.halfEdges.values()][0]!.uv!;
    expect(first.u).toBeCloseTo(1 - before.v * 2);
    expect(first.v).toBeCloseTo(2 + before.u * 2);
    expect(transformed.vertices).toEqual(projected.vertices);
  });
});
