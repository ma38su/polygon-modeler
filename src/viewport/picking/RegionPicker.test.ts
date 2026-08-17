import { describe, expect, it } from "vitest";
import { PerspectiveCamera } from "three";
import { ModelObject } from "../../editor/document/ModelObject";
import type { ObjectId } from "../../editor/document/types";
import { createBoxMesh } from "../../editor/mesh/primitives/box";
import { RenderGeometryAdapter } from "../adapters/RenderGeometryAdapter";
import { RegionPicker } from "./RegionPicker";

const bounds = {
  left: 0,
  top: 0,
  width: 500,
  height: 500,
} as DOMRect;

describe("RegionPicker", () => {
  it.each(["box", "lasso"] as const)(
    "selects enabled elements inside a %s region",
    (shape) => {
      const object = new ModelObject(
        "object-1" as ObjectId,
        "Box",
        createBoxMesh(),
      ).toSnapshot();
      const adapter = new RenderGeometryAdapter();
      adapter.sync([object], new Set(), [], {
        vertices: true,
        edges: true,
        faces: true,
      });
      const camera = new PerspectiveCamera(45, 1, 0.01, 100);
      camera.position.set(0, 0, 8);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      const points =
        shape === "box"
          ? [
              { x: 100, y: 100 },
              { x: 400, y: 400 },
            ]
          : [
              { x: 80, y: 80 },
              { x: 420, y: 80 },
              { x: 420, y: 420 },
              { x: 80, y: 420 },
            ];

      const items = new RegionPicker().pick(
        points,
        shape,
        bounds,
        camera,
        adapter,
        [object],
        new Set(["vertex"]),
      );

      expect(items).toHaveLength(8);
      expect(items.map((item) => item.elementId)).toEqual(
        object.mesh.vertexIds,
      );
      adapter.dispose();
    },
  );
});
