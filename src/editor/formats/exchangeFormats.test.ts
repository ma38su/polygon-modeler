import { describe, expect, it } from "vitest";
import { ModelObject } from "../document/ModelObject";
import type { ObjectId } from "../document/types";
import { createBoxMesh } from "../mesh/primitives/box";
import { EditableMesh } from "../mesh/EditableMesh";
import {
  exportGlb,
  exportObj,
  exportStl,
  importGlb,
  importObj,
  importStl,
} from "./exchangeFormats";

describe("exchange formats", () => {
  it("round-trips STL through millimeters without changing meter dimensions", () => {
    const object = new ModelObject(
      "object-1" as ObjectId,
      "Box",
      createBoxMesh(),
    );
    const result = importStl(exportStl([object.toSnapshot()]))[0]!.mesh;
    const xs = [...result.vertices.values()].map((vertex) => vertex.position.x);
    expect(Math.min(...xs)).toBeCloseTo(-1);
    expect(Math.max(...xs)).toBeCloseTo(1);
  });

  it("rejects empty scenes and empty meshes with useful errors", () => {
    expect(() => exportStl([])).toThrow("オブジェクトがありません");
    const object = new ModelObject(
      "object-1" as ObjectId,
      "Empty",
      EditableMesh.fromPolygons([], []),
    );
    expect(() => exportStl([object.toSnapshot()])).toThrow(
      "エクスポート可能な面がありません",
    );
  });

  it("exports and imports a binary GLB", async () => {
    const object = new ModelObject(
      "object-1" as ObjectId,
      "GLB Box",
      createBoxMesh(),
    );
    object.transform = {
      position: { x: 3, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };
    object.material = {
      color: "#336699",
      shading: "standard",
      roughness: 0.3,
      metalness: 0.8,
    };
    const imported = await importGlb(await exportGlb([object.toSnapshot()]));
    const xs = [...imported[0]!.mesh.vertices.values()].map(
      (vertex) => vertex.position.x,
    );
    expect(imported[0]!.name).toBe("GLB_Box");
    expect(Math.min(...xs)).toBeCloseTo(2);
    expect(Math.max(...xs)).toBeCloseTo(4);
    expect(imported[0]!.material).toMatchObject({
      color: "#336699",
      roughness: 0.3,
      metalness: 0.8,
    });
  });

  it("imports polygon faces, negative indices, groups, and corner UVs from OBJ", () => {
    const imported = importObj(`
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
vt 0 0
vt 1 0
vt 1 1
vt 0 1
g Quad
f -4/1 -3/2 -2/3 -1/4
`);
    expect(imported[0]!.name).toBe("Quad");
    expect(imported[0]!.mesh.faces.size).toBe(1);
    expect(imported[0]!.mesh.toMeshData().faceUvs![0]).toEqual([
      { u: 0, v: 0 },
      { u: 1, v: 0 },
      { u: 1, v: 1 },
      { u: 0, v: 1 },
    ]);
  });

  it("round-trips transformed OBJ geometry and UVs", () => {
    const object = new ModelObject(
      "object-1" as ObjectId,
      "UV Box",
      createBoxMesh(),
    );
    object.transform = {
      position: { x: 2, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };
    object.mesh.halfEdges.values().next().value!.uv = { u: 0.2, v: 0.8 };
    const restored = importObj(exportObj([object.toSnapshot()]))[0]!.mesh;
    const xs = [...restored.vertices.values()].map(
      (vertex) => vertex.position.x,
    );
    expect(Math.min(...xs)).toBeCloseTo(1);
    expect(Math.max(...xs)).toBeCloseTo(3);
    expect(
      [...restored.halfEdges.values()].some(
        (halfEdge) => halfEdge.uv?.u === 0.2,
      ),
    ).toBe(true);
  });
});
