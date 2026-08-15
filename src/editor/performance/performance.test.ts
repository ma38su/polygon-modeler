import { describe, expect, it } from "vitest";
import { EditableMesh } from "../mesh/EditableMesh";
import { validateMesh } from "../mesh/validateMesh";

function createGrid(size: number): EditableMesh {
  const positions = Array.from({ length: size * size }, (_, index) => ({
    x: index % size,
    y: 0,
    z: Math.floor(index / size),
  }));
  const faces: number[][] = [];
  for (let z = 0; z < size - 1; z++)
    for (let x = 0; x < size - 1; x++) {
      const a = z * size + x;
      faces.push([a, a + size, a + size + 1, a + 1]);
    }
  return EditableMesh.fromPolygons(positions, faces);
}

describe("large mesh performance budget", () => {
  it("builds, validates, clones, and archives a 10k vertex mesh", () => {
    const started = performance.now();
    const mesh = createGrid(100);
    expect(validateMesh(mesh).valid).toBe(true);
    const clone = mesh.clone();
    const archive = clone.toArchive();
    const restored = EditableMesh.fromArchive(archive);
    const elapsed = performance.now() - started;
    expect(restored.vertices.size).toBe(10_000);
    expect(restored.faces.size).toBe(9_801);
    expect(elapsed).toBeLessThan(2_500);
  });
});
