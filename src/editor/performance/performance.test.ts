import { describe, expect, it } from "vitest";
import { EditableMesh } from "../mesh/EditableMesh";
import { validateMesh } from "../mesh/validateMesh";
import { changeSelectionByAdjacency } from "../selection/topologySelection";
import { ModelObject } from "../document/ModelObject";
import type { ObjectId } from "../document/types";
import { RenderGeometryAdapter } from "../../viewport/adapters/RenderGeometryAdapter";
import { Editor } from "../Editor";

function createGrid(size: number): EditableMesh {
  const positions = Array.from({ length: size * size }, (_, index) => ({
    x: index % size,
    y: 0,
    z: Math.floor(index / size),
  }));
  const faces: number[][] = [];
  for (let z = 0; z < size - 1; z++)
    for (let x = 0; x < size - 1; x++) {
      const a = z * size + x;
      faces.push([a, a + size, a + size + 1, a + 1]);
    }
  return EditableMesh.fromPolygons(positions, faces);
}

describe("large mesh performance budget", () => {
  it("builds, validates, clones, and archives a 10k vertex mesh", () => {
    const started = performance.now();
    const mesh = createGrid(100);
    expect(validateMesh(mesh).valid).toBe(true);
    const clone = mesh.clone();
    const archive = clone.toArchive();
    const restored = EditableMesh.fromArchive(archive);
    const elapsed = performance.now() - started;
    expect(restored.vertices.size).toBe(10_000);
    expect(restored.faces.size).toBe(9_801);
    expect(elapsed).toBeLessThan(2_500);
  });

  it("selects, prepares rendering, and undoes edits on a 10k vertex mesh", () => {
    const mesh = createGrid(100);
    const firstVertex = [...mesh.vertices.keys()][0]!;

    const selectionStarted = performance.now();
    const connected = changeSelectionByAdjacency(
      mesh,
      [firstVertex],
      "connected",
    );
    const selectionElapsed = performance.now() - selectionStarted;
    expect(connected).toHaveLength(10_000);
    expect(selectionElapsed).toBeLessThan(1_000);

    const objectId = "object-performance" as ObjectId;
    const object = new ModelObject(objectId, "Large grid", mesh).toSnapshot();
    const adapter = new RenderGeometryAdapter();
    const renderStarted = performance.now();
    adapter.sync(
      [object],
      new Set([objectId]),
      connected.map((elementId) => ({ objectId, elementId })),
      { vertices: true, edges: true, faces: true },
    );
    const renderElapsed = performance.now() - renderStarted;
    expect(adapter.getMesh(objectId)).toBeDefined();
    expect(renderElapsed).toBeLessThan(2_000);
    adapter.dispose();

    const editor = new Editor();
    const [editorObjectId] = editor.importMeshes([{ name: "Large", mesh }]);
    editor.setSelectionMode("vertex");
    editor.selectElement({ objectId: editorObjectId!, elementId: firstVertex });
    const undoStarted = performance.now();
    editor.translateSelected({ x: 1, y: 0, z: 0 });
    editor.undo();
    const undoElapsed = performance.now() - undoStarted;
    expect(undoElapsed).toBeLessThan(1_000);
    expect(editor.getSnapshot().objects[0]!.mesh.positions[0]).toBe(0);
  });
});
