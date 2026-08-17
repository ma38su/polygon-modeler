import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { ModelObject } from "../../editor/document/ModelObject";
import type { ObjectId } from "../../editor/document/types";
import { createBoxMesh } from "../../editor/mesh/primitives/box";
import { EditableMesh } from "../../editor/mesh/EditableMesh";
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

  it("requires every edge endpoint and face vertex to be enclosed by a lasso", () => {
    const mesh = EditableMesh.fromPolygons(
      [
        { x: -1, y: -1, z: 0 },
        { x: 1, y: -1, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: -1, y: 1, z: 0 },
      ],
      [[0, 1, 2, 3]],
    );
    const object = new ModelObject(
      "object-1" as ObjectId,
      "Quad",
      mesh,
    ).toSnapshot();
    const adapter = new RenderGeometryAdapter();
    adapter.sync([object], new Set(), [], {
      vertices: true,
      edges: true,
      faces: true,
    });
    const camera = testCamera();
    const centerLasso = [
      { x: 220, y: 220 },
      { x: 280, y: 220 },
      { x: 280, y: 280 },
      { x: 220, y: 280 },
    ];
    const picker = new RegionPicker();

    expect(
      picker.pick(
        centerLasso,
        "lasso",
        bounds,
        camera,
        adapter,
        [object],
        new Set(["edge", "face"]),
      ),
    ).toEqual([]);
    expect(
      picker.pick(
        [
          { x: 220, y: 220 },
          { x: 280, y: 280 },
        ],
        "box",
        bounds,
        camera,
        adapter,
        [object],
        new Set(["edge", "face"]),
      ),
    ).not.toEqual([]);
    adapter.dispose();
  });

  it("treats projected vertices on the lasso stroke as enclosed", () => {
    const mesh = EditableMesh.fromPolygons(
      [
        { x: -1, y: -1, z: 0 },
        { x: 1, y: -1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      [[0, 1, 2]],
    );
    const object = new ModelObject(
      "object-1" as ObjectId,
      "Triangle",
      mesh,
    ).toSnapshot();
    const adapter = new RenderGeometryAdapter();
    adapter.sync([object], new Set(), [], {
      vertices: true,
      edges: true,
      faces: true,
    });
    const camera = testCamera();
    const polygon = object.mesh.positions.reduce<{ x: number; y: number }[]>(
      (points, _, index) => {
        if (index % 3) return points;
        const p = new Vector3()
          .fromArray(object.mesh.positions, index)
          .project(camera);
        points.push({
          x: ((p.x + 1) * bounds.width) / 2,
          y: ((1 - p.y) * bounds.height) / 2,
        });
        return points;
      },
      [],
    );
    const items = new RegionPicker().pick(
      polygon,
      "lasso",
      bounds,
      camera,
      adapter,
      [object],
      new Set(["vertex", "edge", "face"]),
    );
    expect(items).toHaveLength(7);
    adapter.dispose();
  });
});

function testCamera() {
  const camera = new PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}
