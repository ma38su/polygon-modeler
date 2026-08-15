import { ModelDocument } from "./document/ModelDocument";
import { ModelObject } from "./document/ModelObject";
import type { EditorSnapshot, ObjectId } from "./document/types";
import { createBoxMesh } from "./mesh/primitives/box";
type Listener = () => void;
export class Editor {
  readonly document = new ModelDocument();
  readonly #listeners = new Set<Listener>();
  readonly #selectedObjectIds = new Set<ObjectId>();
  #nextObjectId = 1;
  #revision = 0;
  #snapshot: EditorSnapshot = this.#createSnapshot();
  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  getSnapshot = (): EditorSnapshot => this.#snapshot;
  createBox(): ObjectId {
    const sequence = this.#nextObjectId++;
    const id = `object-${sequence}` as ObjectId;
    this.document.addObject(
      new ModelObject(id, `Box ${sequence}`, createBoxMesh()),
    );
    this.#selectedObjectIds.clear();
    this.#selectedObjectIds.add(id);
    this.#commit();
    return id;
  }
  deleteSelectedObjects(): void {
    if (this.#selectedObjectIds.size === 0) return;
    for (const id of this.#selectedObjectIds) this.document.removeObject(id);
    this.#selectedObjectIds.clear();
    this.#commit();
  }
  selectObject(id?: ObjectId): void {
    if (id && !this.document.getObject(id)) return;
    this.#selectedObjectIds.clear();
    if (id) this.#selectedObjectIds.add(id);
    this.#commit();
  }
  setObjectVisible(id: ObjectId, visible: boolean): void {
    const object = this.document.getObject(id);
    if (!object || object.visible === visible) return;
    object.visible = visible;
    this.#commit();
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
    };
  }
}
