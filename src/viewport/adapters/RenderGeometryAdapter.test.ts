import { describe, expect, it } from "vitest";
import { ModelObject } from "../../editor/document/ModelObject";
import type { ObjectId } from "../../editor/document/types";
import { createBoxMesh } from "../../editor/mesh/primitives/box";
import type { SelectionItem } from "../../editor/selection/SelectionManager";
import { RenderGeometryAdapter } from "./RenderGeometryAdapter";

const objectId = "object-1" as ObjectId;
const createSnapshot = () =>
  new ModelObject(objectId, "Box", createBoxMesh()).toSnapshot();

describe("RenderGeometryAdapter selection overlays", () => {
  it("shows vertex, edge, and face layers independently of selection mode", () => {
    const adapter = new RenderGeometryAdapter();
    const object = createSnapshot();

    adapter.sync([object], new Set([objectId]), [], {
      vertices: true,
      edges: false,
      faces: true,
    });
    expect(
      adapter.getOverlay(objectId)?.getObjectByName("vertex-overlay"),
    ).toBeDefined();
    expect(
      adapter.getOverlay(objectId)?.getObjectByName("edge-overlay"),
    ).toBeUndefined();

    adapter.sync([object], new Set([objectId]), [], {
      vertices: false,
      edges: true,
      faces: true,
    });
    expect(
      adapter.getOverlay(objectId)?.getObjectByName("edge-overlay"),
    ).toBeDefined();

    const faceSelection: SelectionItem = {
      objectId,
      elementId: object.mesh.faceIds[0]!,
    };
    adapter.sync([object], new Set([objectId]), [faceSelection], {
      vertices: false,
      edges: false,
      faces: true,
    });
    expect(
      adapter.getOverlay(objectId)?.getObjectByName("face-selection-overlay"),
    ).toBeDefined();

    adapter.sync([object], new Set([objectId]), [], {
      vertices: false,
      edges: false,
      faces: false,
    });
    expect(adapter.getOverlay(objectId)).toBeUndefined();
    const mesh = adapter.getMesh(objectId)!;
    expect(mesh.visible).toBe(true);
    expect(
      (mesh.material as import("three").MeshStandardMaterial).opacity,
    ).toBe(0);
    adapter.dispose();
  });

  it("renders visible and selected vertices at the same size", () => {
    const adapter = new RenderGeometryAdapter();
    const object = createSnapshot();
    adapter.sync(
      [object],
      new Set([objectId]),
      [{ objectId, elementId: object.mesh.vertexIds[0]! }],
      { vertices: true, edges: false, faces: true },
    );
    const overlay = adapter.getOverlay(objectId)!;
    const vertices = overlay.getObjectByName(
      "vertex-overlay",
    ) as import("three").InstancedMesh;
    const selection = overlay.getObjectByName(
      "vertex-selection-overlay",
    ) as import("three").InstancedMesh;
    vertices.geometry.computeBoundingSphere();
    selection.geometry.computeBoundingSphere();
    expect(vertices.count).toBe(object.mesh.vertexIds.length);
    expect(selection.count).toBe(1);
    expect(vertices.geometry.boundingSphere!.radius).toBeGreaterThan(0.02);
    expect(selection.geometry.boundingSphere!.radius).toBeCloseTo(
      vertices.geometry.boundingSphere!.radius,
    );
    adapter.dispose();
  });

  it("retains multiple selected elements in one overlay", () => {
    const adapter = new RenderGeometryAdapter();
    const object = createSnapshot();
    const selection = object.mesh.faceIds.slice(0, 2).map((elementId) => ({
      objectId,
      elementId,
    }));
    adapter.sync([object], new Set([objectId]), selection, {
      vertices: false,
      edges: false,
      faces: true,
    });
    const selectedFaces = adapter
      .getOverlay(objectId)
      ?.getObjectByName("face-selection-overlay") as import("three").Mesh;
    expect(selectedFaces.geometry.getIndex()?.count).toBe(12);
    adapter.dispose();
  });
});
