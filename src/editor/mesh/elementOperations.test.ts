import { describe, expect, it } from "vitest";
import { createBoxMesh } from "./primitives/box";
import { validateMesh } from "./validateMesh";
describe("element operations", () => {
  it("moves shared vertices only once", () => {
    const mesh = createBoxMesh();
    const id = [...mesh.vertices.keys()][0]!;
    mesh.transformVertices(new Set([id]), (p) => ({
      x: p.x + 2,
      y: p.y,
      z: p.z,
    }));
    expect(mesh.vertices.get(id)?.position.x).toBe(1);
  });
  it("restores an exact topology snapshot", () => {
    const mesh = createBoxMesh();
    const before = mesh.clone();
    mesh.deleteFace([...mesh.faces.keys()][0]!);
    mesh.replaceWith(before);
    expect(mesh.toMeshData().faces).toHaveLength(6);
    expect(validateMesh(mesh).valid).toBe(true);
  });
  it("deletes an edge through its adjacent faces without corruption", () => {
    const mesh = createBoxMesh();
    mesh.deleteEdge([...mesh.edges.keys()][0]!);
    expect(validateMesh(mesh).valid).toBe(true);
  });
  it("deletes a vertex and all incident faces without corruption", () => {
    const mesh = createBoxMesh();
    mesh.deleteVertex([...mesh.vertices.keys()][0]!);
    expect(validateMesh(mesh).valid).toBe(true);
  });
});
