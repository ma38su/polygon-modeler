import { useContext, useSyncExternalStore } from "react";
import type { EditorSnapshot } from "../editor/document/types";
import { EditorContext } from "./EditorContext";
export function useEditor() {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error("useEditor must be used inside EditorProvider");
  return editor;
}
export function useEditorSnapshot(): EditorSnapshot {
  const editor = useEditor();
  return useSyncExternalStore(
    editor.subscribe,
    editor.getSnapshot,
    editor.getSnapshot,
  );
}
