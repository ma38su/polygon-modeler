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
  it("selects objects from the outliner without changing element filters", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.toggleSelectionMode("edge");
    const modes = editor.getSnapshot().selectionModes;

    editor.selectObject(objectId);

    expect(editor.getSnapshot().selectedObjectIds).toEqual(new Set([objectId]));
    expect(editor.getSnapshot().selectionItems).toHaveLength(0);
    expect(editor.getSnapshot().selectionModes).toEqual(modes);
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
  it.each(["vertex", "edge", "face"] as const)(
    "moves a selected %s through the shared element transform path",
    (mode) => {
      const editor = new Editor();
      const objectId = editor.createBox();
      editor.setSelectionMode(mode);
      const mesh = editor.getSnapshot().objects[0]!.mesh;
      const elementId =
        mode === "vertex"
          ? mesh.vertexIds[0]!
          : mode === "edge"
            ? mesh.edges[0]!.id
            : mesh.faceIds[0]!;
      editor.selectElement({ objectId, elementId });
      editor.translateSelected({ x: 0, y: 2, z: 0 });
      expect(editor.getSnapshot().objects[0]!.mesh.positions).not.toEqual(
        mesh.positions,
      );
      editor.undo();
      expect(editor.getSnapshot().objects[0]!.mesh.positions).toEqual(
        mesh.positions,
      );
    },
  );
  it("moves multiple selected faces as one undoable edit", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.setSelectionMode("face");
    const mesh = editor.getSnapshot().objects[0]!.mesh;
    editor.selectElement({ objectId, elementId: mesh.faceIds[0]! });
    editor.selectElement({ objectId, elementId: mesh.faceIds[1]! }, true);
    editor.translateSelected({ x: 1, y: 0, z: 0 });
    expect(editor.getSnapshot().objects[0]!.mesh.positions).not.toEqual(
      mesh.positions,
    );
    editor.undo();
    expect(editor.getSnapshot().objects[0]!.mesh.positions).toEqual(
      mesh.positions,
    );
  });
  it("moves mixed vertex and edge selections without double transforms", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.toggleSelectionMode("vertex");
    editor.toggleSelectionMode("edge");
    const mesh = editor.getSnapshot().objects[0]!.mesh;
    const edge = mesh.edges[0]!;
    const sharedVertex = edge.vertices[0];
    editor.selectElement({
      objectId,
      elementId: mesh.vertexIds[sharedVertex]!,
    });
    editor.selectElement({ objectId, elementId: edge.id }, true);
    editor.translateSelected({ x: 1, y: 0, z: 0 });
    const moved = editor.getSnapshot().objects[0]!.mesh.positions;
    expect(moved[sharedVertex * 3]).toBe(mesh.positions[sharedVertex * 3]! + 1);
  });
  it("commits viewport element positions as one undoable transform", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.setSelectionMode("vertex");
    const vertexId = editor.getSnapshot().objects[0]!.mesh.vertexIds[0]!;
    editor.selectElement({ objectId, elementId: vertexId });

    editor.applyElementTransform("要素を回転", [
      {
        objectId,
        vertices: [{ id: vertexId, position: { x: 2, y: 3, z: 4 } }],
      },
    ]);

    expect(editor.getSnapshot().objects[0]!.mesh.positions.slice(0, 3)).toEqual(
      [2, 3, 4],
    );
    editor.undo();
    expect(editor.getSnapshot().objects[0]!.mesh.positions.slice(0, 3)).toEqual(
      [-1, -1, -1],
    );
  });
  it("previews extrusion without changing the document or history", () => {
    const editor = new Editor();
    const objectId = editor.createPlane();
    editor.setSelectionMode("face");
    const faceId = editor.getSnapshot().objects[0]!.mesh.faceIds[0]!;
    editor.selectElement({ objectId, elementId: faceId });
    const before = editor.getSnapshot();

    const preview = editor.previewExtrudeSelectedFaces(2);

    expect(preview[0]!.mesh.faces).toHaveLength(5);
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toHaveLength(1);
    expect(editor.getSnapshot().revision).toBe(before.revision);
    expect(editor.getSnapshot().canUndo).toBe(before.canUndo);
  });
  it("previews and commits an inset as an undoable command", () => {
    const editor = new Editor();
    const objectId = editor.createPlane();
    editor.setSelectionMode("face");
    const faceId = editor.getSnapshot().objects[0]!.mesh.faceIds[0]!;
    editor.selectElement({ objectId, elementId: faceId });

    expect(editor.previewInsetSelectedFaces(0.25)[0]!.mesh.faces).toHaveLength(
      5,
    );
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toHaveLength(1);
    editor.insetSelectedFaces(0.25);
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toHaveLength(5);
    editor.undo();
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toHaveLength(1);
  });
  it("previews and commits a vertex bevel without mutating the preview source", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.setSelectionMode("vertex");
    const vertexId = editor.getSnapshot().objects[0]!.mesh.vertexIds[0]!;
    editor.selectElement({ objectId, elementId: vertexId });
    const originalVertices =
      editor.getSnapshot().objects[0]!.mesh.vertexIds.length;

    expect(
      editor.previewBevelSelectedElements(0.2)[0]!.mesh.vertexIds.length,
    ).toBeGreaterThan(originalVertices);
    expect(editor.getSnapshot().objects[0]!.mesh.vertexIds).toHaveLength(
      originalVertices,
    );
    editor.bevelSelectedElements(0.2);
    expect(
      editor.getSnapshot().objects[0]!.mesh.vertexIds.length,
    ).toBeGreaterThan(originalVertices);
    editor.undo();
    expect(editor.getSnapshot().objects[0]!.mesh.vertexIds).toHaveLength(
      originalVertices,
    );
  });
  it("grows, shrinks, and connects a vertex selection", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.setSelectionMode("vertex");
    const vertexId = editor.getSnapshot().objects[0]!.mesh.vertexIds[0]!;
    editor.selectElement({ objectId, elementId: vertexId });

    editor.growSelection();
    expect(editor.getSnapshot().selectionItems).toHaveLength(4);
    editor.shrinkSelection();
    expect(editor.getSnapshot().selectionItems).toEqual([
      { objectId, elementId: vertexId },
    ]);
    editor.selectConnected();
    expect(editor.getSnapshot().selectionItems).toHaveLength(8);
  });
  it("selects the opposite-edge loop across quad faces", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.setSelectionMode("edge");
    const edgeId = editor.getSnapshot().objects[0]!.mesh.edges[0]!.id;
    editor.selectElement({ objectId, elementId: edgeId });
    editor.selectEdgeLoop();
    expect(editor.getSnapshot().selectionItems).toHaveLength(4);
  });
  it("loop cuts selected quad edge rings as one undoable operation", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.setSelectionMode("edge");
    const edgeId = editor.getSnapshot().objects[0]!.mesh.edges[0]!.id;
    editor.selectElement({ objectId, elementId: edgeId });
    editor.loopCutSelectedEdges();
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toHaveLength(10);
    editor.undo();
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toHaveLength(6);
  });
  it("previews and commits face normal movement", () => {
    const editor = new Editor();
    const objectId = editor.createPlane();
    editor.setSelectionMode("face");
    const faceId = editor.getSnapshot().objects[0]!.mesh.faceIds[0]!;
    editor.selectElement({ objectId, elementId: faceId });
    const preview = editor.previewMoveSelectedAlongNormals(1);
    expect(preview[0]!.mesh.positions[1]).toBe(1);
    expect(editor.getSnapshot().objects[0]!.mesh.positions[1]).toBe(0);
    editor.moveSelectedAlongNormals(1);
    expect(editor.getSnapshot().objects[0]!.mesh.positions[1]).toBe(1);
    editor.undo();
    expect(editor.getSnapshot().objects[0]!.mesh.positions[1]).toBe(0);
  });
  it("previews numeric transforms without changing document history", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.setSelectionMode("vertex");
    const vertexId = editor.getSnapshot().objects[0]!.mesh.vertexIds[0]!;
    editor.selectElement({ objectId, elementId: vertexId });
    const before = editor.getSnapshot();

    const moved = editor.previewTranslateSelected({ x: 2, y: 0, z: 0 });
    expect(moved[0]!.mesh.positions[0]).toBe(
      before.objects[0]!.mesh.positions[0]! + 2,
    );
    expect(editor.getSnapshot().objects).toEqual(before.objects);
    expect(editor.getSnapshot().canUndo).toBe(before.canUndo);
  });
  it("applies an undoable Boolean union to two selected solids", async () => {
    const editor = new Editor();
    const leftId = editor.createBox();
    const rightId = editor.createBox();
    editor.transformObject(rightId, {
      position: { x: 0.75, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
    editor.selectObject(leftId);
    editor.selectObject(rightId, true);

    await editor.booleanSelectedObjects("union");

    expect(editor.getSnapshot().objects).toHaveLength(1);
    expect(editor.getSnapshot().objects[0]!.name).toContain("Union");
    expect(editor.getSnapshot().objects[0]!.mesh.faces.length).toBeGreaterThan(
      6,
    );
    editor.undo();
    expect(editor.getSnapshot().objects).toHaveLength(2);
  });
  it("rejects Boolean operations on an open mesh", async () => {
    const editor = new Editor();
    const planeId = editor.createPlane();
    const boxId = editor.createBox();
    editor.selectObject(planeId);
    editor.selectObject(boxId, true);
    await expect(editor.booleanSelectedObjects("union")).rejects.toThrow(
      "閉じた立体",
    );
  });
  it("repairs selected object normals as an undoable mesh edit", () => {
    const editor = new Editor();
    editor.createBox();
    const before = editor.getSnapshot().objects[0]!.mesh.faces;
    editor.recalculateSelectedObjectNormals();
    expect(editor.getSnapshot().canUndo).toBe(true);
    editor.undo();
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toEqual(before);
  });
  it("converts gizmo movement from world space into object-local space", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.transformObject(objectId, {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: Math.PI / 2 },
      scale: { x: 2, y: 2, z: 2 },
    });
    editor.setSelectionMode("vertex");
    const mesh = editor.getSnapshot().objects[0]!.mesh;
    editor.selectElement({ objectId, elementId: mesh.vertexIds[0]! });
    editor.translateSelectedInWorld({ x: 2, y: 0, z: 0 });
    const moved = editor.getSnapshot().objects[0]!.mesh.positions;
    expect(moved[0]).toBeCloseTo(mesh.positions[0]!);
    expect(moved[1]).toBeCloseTo(mesh.positions[1]! - 1);
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
  it("duplicates and joins multiple outliner objects with undo", () => {
    const editor = new Editor();
    const first = editor.createBox();
    editor.duplicateSelectedObjects();
    expect(editor.getSnapshot().objects).toHaveLength(2);
    editor.undo();
    expect(editor.getSnapshot().objects).toHaveLength(1);
    editor.redo();
    const second = editor.getSnapshot().objects[1]!.id;
    editor.transformObject(second, {
      position: { x: 4, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
    editor.selectObject(first);
    editor.selectObject(second, true);
    editor.joinSelectedObjects();
    expect(editor.getSnapshot().objects).toHaveLength(1);
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toHaveLength(12);
    expect(Math.max(...editor.getSnapshot().objects[0]!.mesh.positions)).toBe(
      5,
    );
    editor.undo();
    expect(editor.getSnapshot().objects).toHaveLength(2);
  });
  it("creates an undoable mirrored object copy", () => {
    const editor = new Editor();
    editor.createPlane();
    editor.mirrorSelectedObjects("x");
    expect(editor.getSnapshot().objects).toHaveLength(2);
    expect(editor.getSnapshot().objects[1]!.name).toContain("Mirror X");
    expect(editor.getSnapshot().objects[1]!.mesh.positions[0]).toBe(1);
    editor.undo();
    expect(editor.getSnapshot().objects).toHaveLength(1);
  });
  it("separates selected faces into a new object", () => {
    const editor = new Editor();
    const objectId = editor.createBox();
    editor.setSelectionMode("face");
    const faceId = editor.getSnapshot().objects[0]!.mesh.faceIds[0]!;
    editor.selectElement({ objectId, elementId: faceId });
    editor.separateSelectedFaces();
    expect(
      editor
        .getSnapshot()
        .objects.map((object) => object.mesh.faces.length)
        .sort(),
    ).toEqual([1, 5]);
    editor.undo();
    expect(editor.getSnapshot().objects).toHaveLength(1);
    expect(editor.getSnapshot().objects[0]!.mesh.faces).toHaveLength(6);
  });
});
