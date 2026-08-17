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
  it("creates the selected shading material and updates PBR parameters", () => {
    const adapter = new RenderGeometryAdapter();
    const source = new ModelObject(objectId, "Box", createBoxMesh());
    source.material = {
      color: "#ff8844",
      shading: "phong",
      roughness: 0.3,
      metalness: 0.7,
    };
    adapter.sync([source.toSnapshot()], new Set(), []);
    expect(
      (adapter.getMesh(objectId)!.material as import("three").MeshPhongMaterial)
        .isMeshPhongMaterial,
    ).toBe(true);
    source.material = { ...source.material, shading: "standard" };
    adapter.sync([source.toSnapshot()], new Set(), []);
    const material = adapter.getMesh(objectId)!
      .material as import("three").MeshStandardMaterial;
    expect(material.roughness).toBe(0.3);
    expect(material.metalness).toBe(0.7);
    adapter.dispose();
  });

  it("renders face normals only when the diagnostic layer is enabled", () => {
    const adapter = new RenderGeometryAdapter();
    const object = createSnapshot();
    adapter.sync([object], new Set(), [], {
      vertices: false,
      edges: false,
      faces: true,
      normals: true,
    });
    const normals = adapter
      .getOverlay(objectId)
      ?.getObjectByName("normal-overlay") as import("three").LineSegments;
    expect(normals.geometry.getAttribute("position").count).toBe(12);
    adapter.dispose();
  });

  it("updates edge selection colors without rebuilding unchanged geometry layers", () => {
    const adapter = new RenderGeometryAdapter();
    const object = createSnapshot();
    adapter.sync([object], new Set(), [], {
      vertices: true,
      edges: true,
      faces: true,
    });
    const overlay = adapter.getOverlay(objectId)!;
    const vertices = overlay.getObjectByName("vertex-overlay");
    const edges = overlay.getObjectByName(
      "edge-overlay",
    ) as import("three").LineSegments;
    const colors = edges.geometry.getAttribute("color");
    const before = colors.getX(0);

    adapter.sync(
      [object],
      new Set(),
      [{ objectId, elementId: object.mesh.edges[0]!.id }],
      { vertices: true, edges: true, faces: true },
    );

    expect(adapter.getOverlay(objectId)).toBe(overlay);
    expect(overlay.getObjectByName("vertex-overlay")).toBe(vertices);
    expect(overlay.getObjectByName("edge-overlay")).toBe(edges);
    expect(colors.getX(0)).not.toBe(before);
    adapter.dispose();
  });

  it("replaces and clears the independent hover overlay", () => {
    const adapter = new RenderGeometryAdapter();
    const object = createSnapshot();
    adapter.sync([object], new Set(), []);
    adapter.setHover({ objectId, elementId: object.mesh.vertexIds[0]! });
    const mesh = adapter.getMesh(objectId)!;
    expect(mesh.getObjectByName("hover-overlay")).toBeDefined();
    adapter.setHover({ objectId, elementId: object.mesh.faceIds[0]! });
    expect(mesh.getObjectByName("hover-overlay")).toBeDefined();
    expect(mesh.getObjectByName("hover-overlay")!.children[0]).toHaveProperty(
      "isMesh",
      true,
    );
    adapter.setHover(undefined);
    expect(mesh.getObjectByName("hover-overlay")).toBeUndefined();
    adapter.dispose();
  });
});
