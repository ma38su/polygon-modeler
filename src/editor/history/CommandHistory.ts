import type { EditorCommand } from "../commands/EditorCommand";
import type { ModelDocument } from "../document/ModelDocument";
export class CommandHistory {
  readonly #undoStack: EditorCommand[] = [];
  readonly #redoStack: EditorCommand[] = [];
  get canUndo() {
    return this.#undoStack.length > 0;
  }
  get canRedo() {
    return this.#redoStack.length > 0;
  }
  execute(command: EditorCommand, document: ModelDocument): void {
    command.execute(document);
    this.#undoStack.push(command);
    this.#redoStack.length = 0;
  }
  undo(document: ModelDocument): void {
    const command = this.#undoStack.pop();
    if (!command) return;
    command.undo(document);
    this.#redoStack.push(command);
  }
  redo(document: ModelDocument): void {
    const command = this.#redoStack.pop();
    if (!command) return;
    command.redo(document);
    this.#undoStack.push(command);
  }
}
