import { describe, expect, it } from "vitest";
import type { ObjectId, VertexId } from "../document/types";
import { SelectionManager } from "./SelectionManager";
const objectId = "object-1" as ObjectId;
const vertex = (id: string) => ({ objectId, elementId: id as VertexId });
describe("SelectionManager", () => {
  it("supports replace, toggle, all, and clear", () => {
    const s = new SelectionManager();
    s.setMode("vertex");
    s.replace(vertex("v-1"));
    s.toggle(vertex("v-2"));
    expect(s.items).toHaveLength(2);
    s.toggle(vertex("v-1"));
    expect(s.items).toEqual([vertex("v-2")]);
    s.selectAll([vertex("v-1"), vertex("v-2")]);
    expect(s.items).toHaveLength(2);
    s.clear();
    expect(s.items).toHaveLength(0);
  });
  it("clears incompatible elements on mode change", () => {
    const s = new SelectionManager();
    s.setMode("vertex");
    s.replace(vertex("v-1"));
    s.setMode("face");
    expect(s.items).toHaveLength(0);
  });
  it("toggles vertex, edge, and face filters independently", () => {
    const selection = new SelectionManager();
    expect(selection.modes).toEqual(new Set(["vertex", "edge", "face"]));
    selection.toggleMode("vertex");
    selection.toggleMode("edge");
    selection.toggleMode("face");
    expect(selection.modes).toEqual(new Set());
    selection.toggleMode("vertex");
    selection.toggleMode("face");
    selection.toggleMode("edge");
    expect(selection.modes).toEqual(new Set(["vertex", "face", "edge"]));
  });
  it("removes elements for a deleted object", () => {
    const s = new SelectionManager();
    s.setMode("vertex");
    s.selectAll([vertex("v-1"), vertex("v-2")]);
    s.removeObject(objectId);
    expect(s.items).toHaveLength(0);
  });
  it("restores mode and items from a snapshot", () => {
    const selection = new SelectionManager();
    selection.setMode("vertex");
    selection.selectAll([vertex("v-1"), vertex("v-2")]);
    const snapshot = selection.snapshot();
    selection.setMode("face");
    selection.restore(snapshot);
    expect(selection.modes).toEqual(new Set(["vertex"]));
    expect(selection.items).toEqual([vertex("v-1"), vertex("v-2")]);
  });
});
