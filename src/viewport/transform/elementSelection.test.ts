import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { ModelObject } from "../../editor/document/ModelObject";
import type { ObjectId } from "../../editor/document/types";
import { createPlaneMesh } from "../../editor/mesh/primitives/plane";
import { RenderGeometryAdapter } from "../adapters/RenderGeometryAdapter";
import { selectionFrameWorld } from "./elementSelection";

const objectId = "object-1" as ObjectId;

describe("element selection transform frame", () => {
  it("places the pivot at the selected element centroid", () => {
    const object = new ModelObject(objectId, "Plane", createPlaneMesh());
    object.transform = {
      ...object.transform,
      position: { x: 3, y: 2, z: 1 },
    };
    const snapshot = object.toSnapshot();
    const adapter = new RenderGeometryAdapter();
    adapter.sync([snapshot], new Set(), []);
    const frame = selectionFrameWorld(
      [snapshot],
      [{ objectId, elementId: snapshot.mesh.faceIds[0]! }],
      adapter,
      "world",
    )!;
    expect(frame.position.toArray()).toEqual([3, 2, 1]);
    expect(frame.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    adapter.dispose();
  });

  it("derives local and normal axes from the object and selected face", () => {
    const object = new ModelObject(objectId, "Plane", createPlaneMesh());
    object.transform = {
      ...object.transform,
      rotation: { x: 0, y: 0, z: Math.PI / 2 },
    };
    const snapshot = object.toSnapshot();
    const adapter = new RenderGeometryAdapter();
    adapter.sync([snapshot], new Set(), []);
    const selection = [{ objectId, elementId: snapshot.mesh.faceIds[0]! }];
    const local = selectionFrameWorld([snapshot], selection, adapter, "local")!;
    const normal = selectionFrameWorld(
      [snapshot],
      selection,
      adapter,
      "normal",
    )!;
    expect(local.quaternion.z).toBeCloseTo(Math.SQRT1_2);
    const normalAxis = new Vector3(0, 0, 1).applyQuaternion(normal.quaternion);
    expect(normalAxis.x).toBeCloseTo(-1);
    expect(normalAxis.y).toBeCloseTo(0);
    expect(normalAxis.z).toBeCloseTo(0);
    adapter.dispose();
  });
});
