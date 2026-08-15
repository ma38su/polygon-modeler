import type { EdgeId, FaceId, ObjectId, VertexId } from "../document/types";
export type SelectionMode = "object" | "vertex" | "edge" | "face";
export type ElementId = ObjectId | VertexId | EdgeId | FaceId;
export interface SelectionItem {
  readonly objectId: ObjectId;
  readonly elementId: ElementId;
}
const keyOf = (item: SelectionItem) => `${item.objectId}:${item.elementId}`;
export class SelectionManager {
  #mode: SelectionMode = "object";
  readonly #items = new Map<string, SelectionItem>();
  get mode() {
    return this.#mode;
  }
  get items() {
    return [...this.#items.values()];
  }
  setMode(mode: SelectionMode) {
    if (mode === this.#mode) return false;
    this.#mode = mode;
    this.#items.clear();
    return true;
  }
  replace(item?: SelectionItem) {
    this.#items.clear();
    if (item) this.#items.set(keyOf(item), item);
  }
  toggle(item: SelectionItem) {
    const key = keyOf(item);
    if (this.#items.has(key)) this.#items.delete(key);
    else this.#items.set(key, item);
  }
  clear() {
    this.#items.clear();
  }
  selectAll(items: readonly SelectionItem[]) {
    this.#items.clear();
    for (const item of items) this.#items.set(keyOf(item), item);
  }
  removeObject(objectId: ObjectId) {
    for (const [key, item] of this.#items)
      if (item.objectId === objectId) this.#items.delete(key);
  }
  has(item: SelectionItem) {
    return this.#items.has(keyOf(item));
  }
}
