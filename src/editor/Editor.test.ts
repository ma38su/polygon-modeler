import { describe, expect, it, vi } from "vitest";
import { Editor } from "./Editor";
describe("Editor", () => {
  it("creates, selects, hides, and deletes a box without DOM dependencies", () => {
    const editor = new Editor();
    const listener = vi.fn();
    editor.subscribe(listener);
    const id = editor.createBox();
    expect(editor.getSnapshot().objects).toHaveLength(1);
    expect(editor.getSnapshot().selectedObjectIds.has(id)).toBe(true);
    expect(editor.getSnapshot().objects[0]?.mesh.faces).toHaveLength(6);
    editor.setObjectVisible(id, false);
    expect(editor.getSnapshot().objects[0]?.visible).toBe(false);
    editor.deleteSelectedObjects();
    expect(editor.getSnapshot().objects).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(3);
  });
  it("generates IDs independently from array positions", () => {
    const editor = new Editor();
    const first = editor.createBox();
    editor.deleteSelectedObjects();
    expect(editor.createBox()).not.toBe(first);
  });
  it("selects all stable elements and clears them on mode changes", () => {
    const editor = new Editor();
    editor.createBox();
    editor.setSelectionMode("vertex");
    editor.selectAll();
    expect(editor.getSnapshot().selectionItems).toHaveLength(8);
    editor.setSelectionMode("edge");
    expect(editor.getSnapshot().selectionItems).toHaveLength(0);
    editor.selectAll();
    expect(editor.getSnapshot().selectionItems).toHaveLength(12);
    editor.setSelectionMode("face");
    editor.selectAll();
    expect(editor.getSnapshot().selectionItems).toHaveLength(6);
    editor.clearSelection();
    expect(editor.getSnapshot().selectionItems).toHaveLength(0);
  });
  it("transforms shared element vertices once and restores them with undo", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.setSelectionMode("face");
    const faceId = editor.getSnapshot().objects[0]!.mesh.faceIds[0]!;
    editor.selectElement({ objectId, elementId: faceId });
    editor.translateSelected({ x: 2, y: 0, z: 0 });
    const moved = editor.getSnapshot().objects[0]!.mesh.positions;
    expect(
      moved.filter((_, index) => index % 3 === 0 && moved[index] === 1),
    ).toHaveLength(4);
    editor.undo();
    expect(editor.getSnapshot().objects[0]!.mesh.positions[0]).toBe(-1);
  });
  it("restores topology and selection when element deletion is undone", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.setSelectionMode("face");
    const faceId = editor.getSnapshot().objects[0]!.mesh.faceIds[0]!;
    editor.selectElement({ objectId, elementId: faceId });
    editor.deleteSelectedElements();
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toHaveLength(5);
    expect(editor.getSnapshot().selectionItems).toHaveLength(0);
    editor.undo();
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toHaveLength(6);
    expect(editor.getSnapshot().selectionItems[0]?.elementId).toBe(faceId);
    editor.redo();
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toHaveLength(5);
    expect(editor.getSnapshot().selectionItems).toHaveLength(0);
  });
  it("extrudes selected faces as an undoable command", () => {
    const editor = new Editor();
    const objectId = editor.createPlane();
    editor.setSelectionMode("face");
    const faceId = editor.getSnapshot().objects[0]!.mesh.faceIds[0]!;
    editor.selectElement({ objectId, elementId: faceId });
    editor.extrudeSelectedFaces(1);
    const extruded = editor.getSnapshot().objects[0]!.mesh;
    expect(extruded.faces).toHaveLength(5);
    editor.undo();
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toHaveLength(1);
    expect(editor.getSnapshot().selectionItems[0]?.elementId).toBe(faceId);
    editor.redo();
    expect(editor.getSnapshot().objects[0]!.mesh).toEqual(extruded);
  });
  it("loads a project cleanly and starts a new undo history", () => {
    const sourceEditor = new Editor();
    const id = sourceEditor.createBox();
    sourceEditor.transformObject(id, {
      position: { x: 4, y: 5, z: 6 },
      rotation: { x: 0, y: 0.5, z: 0 },
      scale: { x: 2, y: 2, z: 2 },
    });
    const source = sourceEditor.serializeProject();

    const editor = new Editor();
    editor.createPlane();
    editor.loadProject(source);
    expect(editor.getSnapshot().objects).toEqual(
      sourceEditor.getSnapshot().objects,
    );
    expect(editor.getSnapshot().isDirty).toBe(false);
    expect(editor.getSnapshot().canUndo).toBe(false);
    editor.createPlane();
    expect(editor.getSnapshot().canUndo).toBe(true);
    expect(editor.getSnapshot().isDirty).toBe(true);
  });
});
