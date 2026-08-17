import type { EdgeId, FaceId, ObjectId, VertexId } from "../document/types";
export type SelectionMode = "object" | "vertex" | "edge" | "face";
export type ElementId = ObjectId | VertexId | EdgeId | FaceId;
export interface SelectionItem {
  readonly objectId: ObjectId;
  readonly elementId: ElementId;
}
export interface SelectionSnapshot {
  readonly modes: readonly SelectionMode[];
  readonly items: readonly SelectionItem[];
}
const keyOf = (item: SelectionItem) => `${item.objectId}:${item.elementId}`;
export class SelectionManager {
  readonly #modes = new Set<SelectionMode>(["object"]);
  readonly #items = new Map<string, SelectionItem>();
  get mode() {
    if (this.#modes.has("object")) return "object";
    return (
      (["vertex", "edge", "face"] as const).find((mode) =>
        this.#modes.has(mode),
      ) ?? "vertex"
    );
  }
  get modes() {
    return new Set(this.#modes);
  }
  get items() {
    return [...this.#items.values()];
  }
  setMode(mode: SelectionMode) {
    if (this.#modes.size === 1 && this.#modes.has(mode)) return false;
    this.#modes.clear();
    this.#modes.add(mode);
    this.#items.clear();
    return true;
  }
  toggleMode(mode: Exclude<SelectionMode, "object">) {
    if (this.#modes.has("object")) this.#modes.clear();
    if (this.#modes.has(mode)) this.#modes.delete(mode);
    else this.#modes.add(mode);
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
  snapshot(): SelectionSnapshot {
    return { modes: [...this.#modes], items: this.items };
  }
  restore(snapshot: SelectionSnapshot): void {
    this.#modes.clear();
    for (const mode of snapshot.modes) this.#modes.add(mode);
    this.#items.clear();
    for (const item of snapshot.items) this.#items.set(keyOf(item), item);
  }
}
