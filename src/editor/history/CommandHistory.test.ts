import { describe, expect, it } from "vitest";
import { Editor } from "../Editor";
describe("Command history", () => {
  it("survives more than 50 undo and redo operations", () => {
    const editor = new Editor();
    for (let i = 0; i < 60; i += 1) editor.createBox();
    for (let i = 0; i < 60; i += 1) editor.undo();
    expect(editor.getSnapshot().objects).toHaveLength(0);
    for (let i = 0; i < 60; i += 1) editor.redo();
    expect(editor.getSnapshot().objects).toHaveLength(60);
  });
  it("discards redo after a branch", () => {
    const editor = new Editor();
    editor.createBox();
    editor.undo();
    editor.createBox();
    expect(editor.getSnapshot().canRedo).toBe(false);
  });
  it("undoes and redoes transforms", () => {
    const editor = new Editor();
    const id = editor.createBox();
    const object = editor.getSnapshot().objects[0]!;
    editor.transformObject(id, {
      ...object.transform,
      position: { x: 2, y: 3, z: 4 },
    });
    expect(editor.getSnapshot().objects[0]?.transform.position.x).toBe(2);
    editor.undo();
    expect(editor.getSnapshot().objects[0]?.transform.position.x).toBe(0);
    editor.redo();
    expect(editor.getSnapshot().objects[0]?.transform.position.x).toBe(2);
  });
});
