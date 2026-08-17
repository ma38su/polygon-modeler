import type { EditorCommand } from "../commands/EditorCommand";
import type { ModelDocument } from "../document/ModelDocument";
export class CommandHistory {
  static readonly maxEntries = 200;
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
    if (this.#undoStack.length > CommandHistory.maxEntries)
      this.#undoStack.splice(
        0,
        this.#undoStack.length - CommandHistory.maxEntries,
      );
    this.#redoStack.length = 0;
  }
  undo(document: ModelDocument): EditorCommand | undefined {
    const command = this.#undoStack.pop();
    if (!command) return undefined;
    command.undo(document);
    this.#redoStack.push(command);
    return command;
  }
  redo(document: ModelDocument): EditorCommand | undefined {
    const command = this.#redoStack.pop();
    if (!command) return undefined;
    command.redo(document);
    this.#undoStack.push(command);
    return command;
  }
  clear(): void {
    this.#undoStack.length = 0;
    this.#redoStack.length = 0;
  }
  get undoCount(): number {
    return this.#undoStack.length;
  }
  get redoCount(): number {
    return this.#redoStack.length;
  }
}
