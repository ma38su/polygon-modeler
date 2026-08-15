import { describe, expect, it } from "vitest";
import { ModelObject } from "../document/ModelObject";
import type { ObjectId } from "../document/types";
import { createBoxMesh } from "../mesh/primitives/box";
import { EditableMesh } from "../mesh/EditableMesh";
import { exportGlb, exportStl, importGlb, importStl } from "./exchangeFormats";

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
    const imported = await importGlb(await exportGlb([object.toSnapshot()]));
    const xs = [...imported[0]!.mesh.vertices.values()].map(
      (vertex) => vertex.position.x,
    );
    expect(imported[0]!.name).toBe("GLB_Box");
    expect(Math.min(...xs)).toBeCloseTo(2);
    expect(Math.max(...xs)).toBeCloseTo(4);
  });
});
