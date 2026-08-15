import type { ModelDocument } from "../document/ModelDocument";
export interface EditorCommand {
  readonly label: string;
  execute(document: ModelDocument): void;
  undo(document: ModelDocument): void;
  redo(document: ModelDocument): void;
}
