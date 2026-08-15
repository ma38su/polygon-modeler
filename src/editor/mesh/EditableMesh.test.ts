import { describe, expect, it } from "vitest";
import { createBoxMesh } from "./primitives/box";
import { createPlaneMesh } from "./primitives/plane";
import { createCylinderMesh } from "./primitives/cylinder";
import { validateMesh } from "./validateMesh";
import { EditableMesh } from "./EditableMesh";

describe("EditableMesh", () => {
  it.each([
    ["box", createBoxMesh()],
    ["plane", createPlaneMesh()],
    ["cylinder", createCylinderMesh()],
  ])("validates the %s primitive", (_, mesh) =>
    expect(validateMesh(mesh)).toEqual({ valid: true, errors: [] }),
  );
  it("represents plane boundaries with single half-edge edges", () => {
    const mesh = createPlaneMesh();
    expect(
      [...mesh.edges.values()].every((edge) => edge.halfEdges.length === 1),
    ).toBe(true);
  });
  it("keeps remaining IDs and invariants stable after face deletion", () => {
    const mesh = createBoxMesh();
    const survivingFace = [...mesh.faces.keys()][1]!;
    const survivingHalfEdge = mesh.faces.get(survivingFace)!.halfEdge;
    const removedFace = [...mesh.faces.keys()][0]!;
    mesh.deleteFace(removedFace);
    expect(mesh.faces.has(survivingFace)).toBe(true);
    expect(mesh.halfEdges.has(survivingHalfEdge)).toBe(true);
    expect(validateMesh(mesh).valid).toBe(true);
    expect(
      [...mesh.edges.values()].filter((edge) => edge.halfEdges.length === 1),
    ).toHaveLength(4);
  });
  it("generates deterministic render geometry", () => {
    expect(createCylinderMesh(1, 2, 8).toMeshData()).toEqual(
      createCylinderMesh(1, 2, 8).toMeshData(),
    );
  });
  it("rejects non-manifold input", () => {
    expect(() => EditableMeshFromNonManifold()).toThrow("Non-manifold");
  });
  it("rejects duplicate directed edges", () => {
    expect(() =>
      EditableMesh.fromPolygons(
        [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 0, z: 1 },
        ],
        [
          [0, 1, 2],
          [0, 1, 3],
        ],
      ),
    ).toThrow("Non-manifold");
  });
});

function EditableMeshFromNonManifold() {
  const positions = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: -1, z: 0 },
  ];
  return EditableMesh.fromPolygons(positions, [
    [0, 1, 2],
    [1, 0, 3],
    [0, 1, 4],
  ]);
}
