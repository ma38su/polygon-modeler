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
});
