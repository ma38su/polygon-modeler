import { ModelDocument } from "./document/ModelDocument";
import { ModelObject } from "./document/ModelObject";
import type {
  EdgeId,
  EditorSnapshot,
  FaceId,
  ObjectId,
  VertexId,
  Vector3Value,
} from "./document/types";
import { createBoxMesh } from "./mesh/primitives/box";
import { createPlaneMesh } from "./mesh/primitives/plane";
import { createCylinderMesh } from "./mesh/primitives/cylinder";
import type { EditableMesh } from "./mesh/EditableMesh";
import { validateMesh } from "./mesh/validateMesh";
import { CommandHistory } from "./history/CommandHistory";
import {
  CreateObjectCommand,
  DeleteObjectCommand,
  TransformObjectCommand,
} from "./commands/objectCommands";
import type { TransformValue } from "./document/types";
import {
  SelectionManager,
  type SelectionItem,
  type SelectionMode,
} from "./selection/SelectionManager";
import { EditMeshCommand } from "./commands/EditMeshCommand";
import { CompositeCommand } from "./commands/CompositeCommand";
import type { EditorCommand } from "./commands/EditorCommand";
import type { SelectionSnapshot } from "./selection/SelectionManager";
import {
  createFace,
  extrudeFaces,
  flipFaces,
  mergeVertices,
  splitEdge,
  splitFace,
} from "./mesh/topologyOperations";
import { deserializeProject, serializeProject } from "./formats/projectFormat";
type Listener = () => void;
export class Editor {
  readonly document = new ModelDocument();
  readonly #listeners = new Set<Listener>();
  readonly #selectedObjectIds = new Set<ObjectId>();
  readonly history = new CommandHistory();
  readonly selection = new SelectionManager();
  readonly #selectionHistory = new WeakMap<
    EditorCommand,
    { before: SelectionSnapshot; after: SelectionSnapshot }
  >();
  #nextObjectId = 1;
  #revision = 0;
  #isDirty = false;
  #snapshot: EditorSnapshot = this.#createSnapshot();
  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  getSnapshot = (): EditorSnapshot => this.#snapshot;
  createBox(): ObjectId {
    return this.#createObject("Box", createBoxMesh());
  }
  createPlane(): ObjectId {
    return this.#createObject("Plane", createPlaneMesh());
  }
  createCylinder(): ObjectId {
    return this.#createObject("Cylinder", createCylinderMesh());
  }
  #createObject(kind: string, mesh: EditableMesh): ObjectId {
    const validation = validateMesh(mesh);
    if (!validation.valid) throw new Error(validation.errors.join("\n"));
    const sequence = this.#nextObjectId++;
    const id = `object-${sequence}` as ObjectId;
    const object = new ModelObject(id, `${kind} ${sequence}`, mesh);
    this.history.execute(new CreateObjectCommand(object), this.document);
    this.#selectedObjectIds.clear();
    this.#selectedObjectIds.add(id);
    this.selection.setMode("object");
    this.selection.replace({ objectId: id, elementId: id });
    this.#commit(true);
    return id;
  }
  deleteSelectedObjects(): void {
    if (this.#selectedObjectIds.size === 0) return;
    this.history.execute(
      new DeleteObjectCommand([...this.#selectedObjectIds]),
      this.document,
    );
    this.#selectedObjectIds.clear();
    this.selection.clear();
    this.#commit(true);
  }
  selectObject(id?: ObjectId): void {
    if (id && !this.document.getObject(id)) return;
    this.#selectedObjectIds.clear();
    this.selection.setMode("object");
    if (id) this.#selectedObjectIds.add(id);
    this.selection.replace(id ? { objectId: id, elementId: id } : undefined);
    this.#commit();
  }
  setSelectionMode(mode: SelectionMode): void {
    if (!this.selection.setMode(mode)) return;
    this.#selectedObjectIds.clear();
    this.#commit();
  }
  selectElement(item?: SelectionItem, additive = false): void {
    if (additive && item) this.selection.toggle(item);
    else this.selection.replace(item);
    this.#selectedObjectIds.clear();
    for (const selected of this.selection.items)
      this.#selectedObjectIds.add(selected.objectId);
    this.#commit();
  }
  clearSelection(): void {
    this.selection.clear();
    this.#selectedObjectIds.clear();
    this.#commit();
  }
  selectAll(): void {
    const items: SelectionItem[] = [];
    for (const object of this.document.toSnapshot()) {
      if (this.selection.mode === "object")
        items.push({ objectId: object.id, elementId: object.id });
      else if (this.selection.mode === "vertex")
        object.mesh.vertexIds.forEach((id) =>
          items.push({ objectId: object.id, elementId: id }),
        );
      else if (this.selection.mode === "edge")
        object.mesh.edges.forEach((edge) =>
          items.push({ objectId: object.id, elementId: edge.id }),
        );
      else
        object.mesh.faceIds.forEach((id) =>
          items.push({ objectId: object.id, elementId: id }),
        );
    }
    this.selection.selectAll(items);
    this.#selectedObjectIds.clear();
    for (const item of items) this.#selectedObjectIds.add(item.objectId);
    this.#commit();
  }
  setObjectVisible(id: ObjectId, visible: boolean): void {
    const object = this.document.getObject(id);
    if (!object || object.visible === visible) return;
    object.visible = visible;
    this.#commit(true);
  }
  transformObject(id: ObjectId, transform: TransformValue): void {
    const object = this.document.getObject(id);
    if (!object) return;
    this.history.execute(
      new TransformObjectCommand(id, object.transform, transform),
      this.document,
    );
    this.#commit(true);
  }
  translateSelected(delta: Vector3Value): void {
    const commands: EditMeshCommand[] = [];
    for (const objectId of new Set(
      this.selection.items.map((item) => item.objectId),
    )) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const ids = this.#selectedVertices(objectId);
      const after = object.mesh.clone();
      after.transformVertices(ids, (position) => ({
        x: position.x + delta.x,
        y: position.y + delta.y,
        z: position.z + delta.z,
      }));
      commands.push(
        new EditMeshCommand("要素を移動", objectId, object.mesh, after),
      );
    }
    if (commands.length) {
      this.history.execute(
        new CompositeCommand("要素を移動", commands),
        this.document,
      );
      this.#commit(true);
    }
  }
  scaleSelected(scale: Vector3Value): void {
    const pivot = this.#selectionPivot();
    this.#transformSelected("要素を拡大縮小", (position) => ({
      x: pivot.x + (position.x - pivot.x) * scale.x,
      y: pivot.y + (position.y - pivot.y) * scale.y,
      z: pivot.z + (position.z - pivot.z) * scale.z,
    }));
  }
  rotateSelected(rotation: Vector3Value): void {
    const pivot = this.#selectionPivot();
    const [cx, sx, cy, sy, cz, sz] = [
      Math.cos(rotation.x),
      Math.sin(rotation.x),
      Math.cos(rotation.y),
      Math.sin(rotation.y),
      Math.cos(rotation.z),
      Math.sin(rotation.z),
    ];
    this.#transformSelected("要素を回転", (position) => {
      let x = position.x - pivot.x;
      let y = position.y - pivot.y;
      let z = position.z - pivot.z;
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      return { x: x + pivot.x, y: y + pivot.y, z: z + pivot.z };
    });
  }
  deleteSelectedElements(): void {
    if (this.selection.mode === "object") {
      this.deleteSelectedObjects();
      return;
    }
    const commands: EditMeshCommand[] = [];
    for (const objectId of new Set(
      this.selection.items.map((item) => item.objectId),
    )) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const after = object.mesh.clone();
      for (const item of this.selection.items.filter(
        (candidate) => candidate.objectId === objectId,
      )) {
        if (this.selection.mode === "vertex")
          after.deleteVertex(item.elementId as VertexId);
        else if (this.selection.mode === "edge")
          after.deleteEdge(item.elementId as EdgeId);
        else after.deleteFace(item.elementId as FaceId);
      }
      commands.push(
        new EditMeshCommand("要素を削除", objectId, object.mesh, after),
      );
    }
    if (commands.length) {
      const command = new CompositeCommand("要素を削除", commands);
      const before = this.selection.snapshot();
      this.history.execute(command, this.document);
      this.selection.clear();
      this.#selectedObjectIds.clear();
      this.#selectionHistory.set(command, {
        before,
        after: this.selection.snapshot(),
      });
      this.#commit(true);
    }
  }
  extrudeSelectedFaces(distance: number): void {
    if (this.selection.mode !== "face") return;
    this.#applyTopology("面を押し出し", (mesh, items) =>
      extrudeFaces(
        mesh,
        new Set(items.map((item) => item.elementId as FaceId)),
        distance,
      ),
    );
  }
  splitSelectedElements(): void {
    if (this.selection.mode !== "face" && this.selection.mode !== "edge")
      return;
    this.#applyTopology("要素を分割", (mesh, items) => {
      const first = items[0];
      if (!first) return mesh.clone();
      return this.selection.mode === "face"
        ? splitFace(mesh, first.elementId as FaceId)
        : splitEdge(mesh, first.elementId as EdgeId);
    });
  }
  flipSelectedFaces(): void {
    if (this.selection.mode !== "face") return;
    this.#applyTopology("面を反転", (mesh, items) =>
      flipFaces(mesh, new Set(items.map((item) => item.elementId as FaceId))),
    );
  }
  mergeSelectedVertices(): void {
    if (this.selection.mode !== "vertex") return;
    this.#applyTopology("頂点を結合", (mesh, items) =>
      items.length >= 2
        ? mergeVertices(
            mesh,
            items[0]!.elementId as VertexId,
            items[1]!.elementId as VertexId,
          )
        : mesh.clone(),
    );
  }
  createFaceFromSelection(): void {
    if (this.selection.mode !== "vertex") return;
    this.#applyTopology("面を生成", (mesh, items) =>
      createFace(
        mesh,
        items.map((item) => item.elementId as VertexId),
      ),
    );
  }
  #applyTopology(
    label: string,
    operation: (
      mesh: EditableMesh,
      items: readonly SelectionItem[],
    ) => EditableMesh,
  ): void {
    const commands: EditMeshCommand[] = [];
    for (const [objectId, items] of this.#selectionGroups()) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const after = operation(object.mesh, items);
      const validation = validateMesh(after);
      if (!validation.valid) throw new Error(validation.errors.join("\n"));
      commands.push(new EditMeshCommand(label, objectId, object.mesh, after));
    }
    if (!commands.length) return;
    const command = new CompositeCommand(label, commands);
    const before = this.selection.snapshot();
    this.history.execute(command, this.document);
    this.selection.clear();
    this.#selectedObjectIds.clear();
    this.#selectionHistory.set(command, {
      before,
      after: this.selection.snapshot(),
    });
    this.#commit(true);
  }
  #selectionGroups(): Map<ObjectId, SelectionItem[]> {
    const groups = new Map<ObjectId, SelectionItem[]>();
    for (const item of this.selection.items) {
      const values = groups.get(item.objectId) ?? [];
      values.push(item);
      groups.set(item.objectId, values);
    }
    return groups;
  }
  #transformSelected(
    label: string,
    transform: (position: Vector3Value) => Vector3Value,
  ): void {
    const commands: EditMeshCommand[] = [];
    for (const objectId of new Set(
      this.selection.items.map((item) => item.objectId),
    )) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const after = object.mesh.clone();
      after.transformVertices(this.#selectedVertices(objectId), transform);
      commands.push(new EditMeshCommand(label, objectId, object.mesh, after));
    }
    if (commands.length) {
      this.history.execute(
        new CompositeCommand(label, commands),
        this.document,
      );
      this.#commit(true);
    }
  }
  #selectionPivot(): Vector3Value {
    const points = [];
    for (const objectId of new Set(
      this.selection.items.map((item) => item.objectId),
    )) {
      const object = this.document.getObject(objectId);
      if (object)
        for (const id of this.#selectedVertices(objectId))
          points.push(object.mesh.vertices.get(id)!.position);
    }
    if (!points.length) return { x: 0, y: 0, z: 0 };
    return points.reduce(
      (sum, point) => ({
        x: sum.x + point.x / points.length,
        y: sum.y + point.y / points.length,
        z: sum.z + point.z / points.length,
      }),
      { x: 0, y: 0, z: 0 },
    );
  }
  #selectedVertices(objectId: ObjectId): Set<VertexId> {
    const result = new Set<VertexId>();
    const object = this.document.getObject(objectId);
    if (!object) return result;
    for (const item of this.selection.items.filter(
      (candidate) => candidate.objectId === objectId,
    )) {
      if (this.selection.mode === "vertex")
        result.add(item.elementId as VertexId);
      else if (this.selection.mode === "edge") {
        const edge = object.mesh.edges.get(item.elementId as EdgeId);
        if (edge)
          for (const halfEdgeId of edge.halfEdges) {
            const halfEdge = object.mesh.halfEdges.get(halfEdgeId)!;
            result.add(halfEdge.origin);
            result.add(halfEdge.destination);
          }
      } else if (this.selection.mode === "face") {
        const face = object.mesh.faces.get(item.elementId as FaceId);
        if (face) for (const id of face.vertices) result.add(id);
      }
    }
    return result;
  }
  undo(): void {
    if (!this.history.canUndo) return;
    const command = this.history.undo(this.document);
    const selection = command ? this.#selectionHistory.get(command) : undefined;
    if (selection) this.#restoreSelection(selection.before);
    this.#reconcileSelection();
    this.#commit(true);
  }
  redo(): void {
    if (!this.history.canRedo) return;
    const command = this.history.redo(this.document);
    const selection = command ? this.#selectionHistory.get(command) : undefined;
    if (selection) this.#restoreSelection(selection.after);
    this.#reconcileSelection();
    this.#commit(true);
  }
  #reconcileSelection(): void {
    for (const id of this.#selectedObjectIds)
      if (!this.document.getObject(id)) this.#selectedObjectIds.delete(id);
  }
  #restoreSelection(snapshot: SelectionSnapshot): void {
    this.selection.restore(snapshot);
    this.#selectedObjectIds.clear();
    for (const item of snapshot.items)
      this.#selectedObjectIds.add(item.objectId);
  }
  serializeProject(): string {
    return serializeProject(this.document.objects());
  }
  loadProject(source: string): void {
    const objects = deserializeProject(source);
    this.document.clear();
    for (const object of objects) this.document.addObject(object);
    this.history.clear();
    this.selection.setMode("object");
    this.selection.clear();
    this.#selectedObjectIds.clear();
    this.#nextObjectId =
      Math.max(
        0,
        ...objects.map((object) => {
          const match = /^object-(\d+)$/.exec(object.id);
          return match ? Number(match[1]) : 0;
        }),
      ) + 1;
    this.#isDirty = false;
    this.#commit();
  }
  markSaved(): void {
    if (!this.#isDirty) return;
    this.#isDirty = false;
    this.#commit();
  }
  #commit(documentChanged = false): void {
    if (documentChanged) this.#isDirty = true;
    this.#revision += 1;
    this.#snapshot = this.#createSnapshot();
    for (const listener of this.#listeners) listener();
  }
  #createSnapshot(): EditorSnapshot {
    return {
      objects: this.document.toSnapshot(),
      selectedObjectIds: new Set(this.#selectedObjectIds),
      revision: this.#revision,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      selectionMode: this.selection.mode,
      selectionItems: this.selection.items,
      isDirty: this.#isDirty,
    };
  }
}
