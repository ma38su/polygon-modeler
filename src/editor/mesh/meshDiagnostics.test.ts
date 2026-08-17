import { describe, expect, it } from "vitest";
import { createBoxMesh } from "./primitives/box";
import { createPlaneMesh } from "./primitives/plane";
import { collectFaceNormalSegments, diagnoseMesh } from "./meshDiagnostics";

describe("mesh diagnostics", () => {
  it("distinguishes a closed solid from an open surface", () => {
    expect(diagnoseMesh(createBoxMesh().toMeshData())).toMatchObject({
      boundaryEdges: 0,
      closed: true,
      healthy: true,
    });
    expect(diagnoseMesh(createPlaneMesh().toMeshData())).toMatchObject({
      boundaryEdges: 4,
      closed: false,
      healthy: true,
    });
  });

  it("returns normalized face normal visualization segments", () => {
    const segments = collectFaceNormalSegments(createPlaneMesh().toMeshData());
    expect(segments).toHaveLength(1);
    expect(segments[0]!.center).toEqual({ x: 0, y: 0, z: 0 });
    expect(segments[0]!.normal).toEqual({ x: 0, y: 1, z: 0 });
  });
});
