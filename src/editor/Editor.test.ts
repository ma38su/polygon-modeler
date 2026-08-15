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
});
