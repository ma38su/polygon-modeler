import { ModelDocument } from "./document/ModelDocument";
import { ModelObject } from "./document/ModelObject";
import type { EditorSnapshot, ObjectId } from "./document/types";
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
type Listener = () => void;
export class Editor {
  readonly document = new ModelDocument();
  readonly #listeners = new Set<Listener>();
  readonly #selectedObjectIds = new Set<ObjectId>();
  readonly history = new CommandHistory();
  readonly selection = new SelectionManager();
  #nextObjectId = 1;
  #revision = 0;
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
    this.#commit();
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
    this.#commit();
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
    this.#commit();
  }
  transformObject(id: ObjectId, transform: TransformValue): void {
    const object = this.document.getObject(id);
    if (!object) return;
    this.history.execute(
      new TransformObjectCommand(id, object.transform, transform),
      this.document,
    );
    this.#commit();
  }
  undo(): void {
    if (!this.history.canUndo) return;
    this.history.undo(this.document);
    this.#reconcileSelection();
    this.#commit();
  }
  redo(): void {
    if (!this.history.canRedo) return;
    this.history.redo(this.document);
    this.#reconcileSelection();
    this.#commit();
  }
  #reconcileSelection(): void {
    for (const id of this.#selectedObjectIds)
      if (!this.document.getObject(id)) this.#selectedObjectIds.delete(id);
  }
  #commit(): void {
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
    };
  }
}
