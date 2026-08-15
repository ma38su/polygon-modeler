import type { EditorCommand } from "./EditorCommand";
import type { ModelDocument } from "../document/ModelDocument";
export class CompositeCommand implements EditorCommand {
  readonly label: string;
  readonly #commands: readonly EditorCommand[];
  constructor(label: string, commands: readonly EditorCommand[]) {
    this.label = label;
    this.#commands = commands;
  }
  execute(document: ModelDocument) {
    for (const command of this.#commands) command.execute(document);
  }
  undo(document: ModelDocument) {
    for (const command of [...this.#commands].reverse()) command.undo(document);
  }
  redo(document: ModelDocument) {
    for (const command of this.#commands) command.redo(document);
  }
}
