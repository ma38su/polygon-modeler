import { ModelObject } from "./ModelObject";
import type { ModelObjectSnapshot, ObjectId } from "./types";
export class ModelDocument {
  readonly #objects = new Map<ObjectId, ModelObject>();
  addObject(object: ModelObject): void {
    if (this.#objects.has(object.id))
      throw new Error(`Object ID already exists: ${object.id}`);
    this.#objects.set(object.id, object);
  }
  removeObject(id: ObjectId): ModelObject | undefined {
    const object = this.#objects.get(id);
    this.#objects.delete(id);
    return object;
  }
  getObject(id: ObjectId): ModelObject | undefined {
    return this.#objects.get(id);
  }
  toSnapshot(): readonly ModelObjectSnapshot[] {
    return [...this.#objects.values()].map((object) => object.toSnapshot());
  }
}
