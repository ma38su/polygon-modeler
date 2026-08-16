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
  it("shows mode-specific vertex, edge, and face layers", () => {
    const adapter = new RenderGeometryAdapter();
    const object = createSnapshot();

    adapter.sync([object], new Set([objectId]), "vertex", []);
    expect(
      adapter.getOverlay(objectId)?.getObjectByName("vertex-overlay"),
    ).toBeDefined();

    adapter.sync([object], new Set([objectId]), "edge", []);
    expect(
      adapter.getOverlay(objectId)?.getObjectByName("edge-overlay"),
    ).toBeDefined();

    const faceSelection: SelectionItem = {
      objectId,
      elementId: object.mesh.faceIds[0]!,
    };
    adapter.sync([object], new Set([objectId]), "face", [faceSelection]);
    expect(
      adapter.getOverlay(objectId)?.getObjectByName("face-selection-overlay"),
    ).toBeDefined();

    adapter.sync([object], new Set([objectId]), "object", []);
    expect(adapter.getOverlay(objectId)).toBeUndefined();
    adapter.dispose();
  });

  it("retains multiple selected elements in one overlay", () => {
    const adapter = new RenderGeometryAdapter();
    const object = createSnapshot();
    const selection = object.mesh.faceIds.slice(0, 2).map((elementId) => ({
      objectId,
      elementId,
    }));
    adapter.sync([object], new Set([objectId]), "face", selection);
    const selectedFaces = adapter
      .getOverlay(objectId)
      ?.getObjectByName("face-selection-overlay") as import("three").Mesh;
    expect(selectedFaces.geometry.getIndex()?.count).toBe(12);
    adapter.dispose();
  });
});
