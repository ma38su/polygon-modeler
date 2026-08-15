import type { EditorCommand } from "./EditorCommand";
import type { ModelDocument } from "../document/ModelDocument";
import type { ObjectId } from "../document/types";
import type { EditableMesh } from "../mesh/EditableMesh";
export class EditMeshCommand implements EditorCommand {
  readonly label: string;
  readonly #objectId: ObjectId;
  readonly #before: EditableMesh;
  readonly #after: EditableMesh;
  constructor(
    label: string,
    objectId: ObjectId,
    before: EditableMesh,
    after: EditableMesh,
  ) {
    this.label = label;
    this.#objectId = objectId;
    this.#before = before.clone();
    this.#after = after.clone();
  }
  execute(document: ModelDocument) {
    this.#apply(document, this.#after);
  }
  undo(document: ModelDocument) {
    this.#apply(document, this.#before);
  }
  redo(document: ModelDocument) {
    this.#apply(document, this.#after);
  }
  #apply(document: ModelDocument, mesh: EditableMesh) {
    const object = document.getObject(this.#objectId);
    if (!object) throw new Error(`Object not found: ${this.#objectId}`);
    object.mesh.replaceWith(mesh);
  }
}
