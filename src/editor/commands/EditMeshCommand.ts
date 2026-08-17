import type { EditorCommand } from "./EditorCommand";
import type { ModelDocument } from "../document/ModelDocument";
import type { ObjectId } from "../document/types";
import type { EditableMesh } from "../mesh/EditableMesh";
import {
  createMeshPatch,
  meshPatchSize,
  type MeshPatch,
} from "../mesh/meshPatch";
export class EditMeshCommand implements EditorCommand {
  readonly label: string;
  readonly #objectId: ObjectId;
  readonly #undoPatch: MeshPatch;
  readonly #redoPatch: MeshPatch;
  readonly retainedEntityCount: number;
  constructor(
    label: string,
    objectId: ObjectId,
    before: EditableMesh,
    after: EditableMesh,
  ) {
    this.label = label;
    this.#objectId = objectId;
    const beforeArchive = before.toArchive();
    const afterArchive = after.toArchive();
    this.#undoPatch = createMeshPatch(afterArchive, beforeArchive);
    this.#redoPatch = createMeshPatch(beforeArchive, afterArchive);
    this.retainedEntityCount =
      meshPatchSize(this.#undoPatch) + meshPatchSize(this.#redoPatch);
  }
  execute(document: ModelDocument) {
    this.#apply(document, this.#redoPatch);
  }
  undo(document: ModelDocument) {
    this.#apply(document, this.#undoPatch);
  }
  redo(document: ModelDocument) {
    this.#apply(document, this.#redoPatch);
  }
  #apply(document: ModelDocument, patch: MeshPatch) {
    const object = document.getObject(this.#objectId);
    if (!object) throw new Error(`Object not found: ${this.#objectId}`);
    object.mesh.applyPatch(patch);
  }
}
