import type { EditorCommand } from "./EditorCommand";
import type { ModelDocument } from "../document/ModelDocument";
import { ModelObject } from "../document/ModelObject";
import type { ObjectId, TransformValue } from "../document/types";
export class CreateObjectCommand implements EditorCommand {
  readonly label = "オブジェクトを作成";
  readonly object: ModelObject;
  constructor(object: ModelObject) {
    this.object = object;
  }
  execute(document: ModelDocument) {
    document.addObject(this.object);
  }
  undo(document: ModelDocument) {
    document.removeObject(this.object.id);
  }
  redo(document: ModelDocument) {
    document.addObject(this.object);
  }
}
export class DeleteObjectCommand implements EditorCommand {
  readonly label = "オブジェクトを削除";
  readonly ids: readonly ObjectId[];
  #objects: ModelObject[] = [];
  constructor(ids: readonly ObjectId[]) {
    this.ids = ids;
  }
  execute(document: ModelDocument) {
    this.#objects = this.ids.flatMap((id) => {
      const object = document.removeObject(id);
      return object ? [object] : [];
    });
  }
  undo(document: ModelDocument) {
    for (const object of this.#objects) document.addObject(object);
  }
  redo(document: ModelDocument) {
    for (const object of this.#objects) document.removeObject(object.id);
  }
}
export class TransformObjectCommand implements EditorCommand {
  readonly label = "オブジェクトを変形";
  readonly id: ObjectId;
  readonly before: TransformValue;
  readonly after: TransformValue;
  constructor(id: ObjectId, before: TransformValue, after: TransformValue) {
    this.id = id;
    this.before = before;
    this.after = after;
  }
  execute(document: ModelDocument) {
    this.#apply(document, this.after);
  }
  undo(document: ModelDocument) {
    this.#apply(document, this.before);
  }
  redo(document: ModelDocument) {
    this.#apply(document, this.after);
  }
  #apply(document: ModelDocument, transform: TransformValue) {
    const object = document.getObject(this.id);
    if (!object) throw new Error(`Object not found: ${this.id}`);
    object.transform = transform;
  }
}
