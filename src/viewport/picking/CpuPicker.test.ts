import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { ModelObject } from "../../editor/document/ModelObject";
import type { ObjectId } from "../../editor/document/types";
import { createBoxMesh } from "../../editor/mesh/primitives/box";
import { createPlaneMesh } from "../../editor/mesh/primitives/plane";
import { RenderGeometryAdapter } from "../adapters/RenderGeometryAdapter";
import { CpuPicker } from "./CpuPicker";

const objectId = "object-1" as ObjectId;

describe("CpuPicker vertex hit area", () => {
  it("selects within four screen pixels and rejects points outside it", () => {
    const object = new ModelObject(
      objectId,
      "Box",
      createBoxMesh(),
    ).toSnapshot();
    const adapter = new RenderGeometryAdapter();
    adapter.sync([object], new Set(), [], {
      vertices: true,
      edges: false,
      faces: false,
    });
    const camera = new PerspectiveCamera(45, 1, 0.01, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const bounds = {
      left: 0,
      top: 0,
      width: 500,
      height: 500,
    } as DOMRect;
    const vertex = new Vector3()
      .fromArray(object.mesh.positions, 0)
      .project(camera);
    const x = ((vertex.x + 1) * bounds.width) / 2;
    const y = ((1 - vertex.y) * bounds.height) / 2;
    const picker = new CpuPicker();

    expect(
      picker.pick(x + 3.9, y, bounds, camera, adapter, [object], "vertex"),
    ).toBeDefined();
    expect(
      picker.pick(x + 4.1, y, bounds, camera, adapter, [object], "vertex"),
    ).toBeUndefined();
    adapter.dispose();
  });
  it("stops at the first hit in vertex, edge, face priority order", () => {
    const object = new ModelObject(
      objectId,
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
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const bounds = {
      left: 0,
      top: 0,
      width: 500,
      height: 500,
    } as DOMRect;
    const vertex = new Vector3()
      .fromArray(object.mesh.positions, 0)
      .project(camera);
    const x = ((vertex.x + 1) * bounds.width) / 2;
    const y = ((1 - vertex.y) * bounds.height) / 2;
    const picker = new CpuPicker();

    expect(
      picker.pickPrioritized(
        x,
        y,
        bounds,
        camera,
        adapter,
        [object],
        new Set(["vertex", "edge", "face"]),
      )?.elementId,
    ).toBe(object.mesh.vertexIds[0]);
    expect(object.mesh.edges.map((edge) => edge.id)).toContain(
      picker.pickPrioritized(
        x,
        y,
        bounds,
        camera,
        adapter,
        [object],
        new Set(["edge", "face"]),
      )?.elementId,
    );
    adapter.dispose();
  });
});

describe("CpuPicker face picking", () => {
  it("picks a newly created upward-facing plane from above", () => {
    const object = new ModelObject(
      objectId,
      "Plane",
      createPlaneMesh(),
    ).toSnapshot();
    const adapter = new RenderGeometryAdapter();
    const [a, b, c] = object.mesh.faces[0]!.map((index) =>
      new Vector3().fromArray(object.mesh.positions, index * 3),
    );
    expect(
      new Vector3().subVectors(b!, a!).cross(new Vector3().subVectors(c!, a!))
        .y,
    ).toBeGreaterThan(0);
    adapter.sync([object], new Set(), [], {
      vertices: false,
      edges: false,
      faces: true,
    });
    adapter.group.updateMatrixWorld(true);
    const camera = new PerspectiveCamera(45, 1, 0.01, 100);
    camera.position.set(0, 5, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const bounds = {
      left: 0,
      top: 0,
      width: 500,
      height: 500,
    } as DOMRect;

    expect(
      new CpuPicker().pick(250, 250, bounds, camera, adapter, [object], "face")
        ?.elementId,
    ).toBe(object.mesh.faceIds[0]);
    adapter.dispose();
  });
});
