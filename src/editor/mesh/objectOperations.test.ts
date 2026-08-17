import { describe, expect, it } from "vitest";
import { createPlaneMesh } from "./primitives/plane";
import { mirrorMesh } from "./objectOperations";
import { validateMesh } from "./validateMesh";

describe("object mesh operations", () => {
  it("mirrors coordinates and reverses winding", () => {
    const source = createPlaneMesh();
    const sourceFace = source.toMeshData().faces[0]!;
    const mirrored = mirrorMesh(source, "x");
    expect(mirrored.toMeshData().positions[0]).toBe(1);
    expect(mirrored.toMeshData().faces[0]).toEqual([...sourceFace].reverse());
    expect(validateMesh(mirrored).valid).toBe(true);
  });
});
