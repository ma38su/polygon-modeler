import { useEffect } from "react";
import type { Editor } from "../../editor/Editor";
export function useEditorShortcuts(editor: Editor): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable=true]")) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
      } else if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        editor.selectAll();
      } else if (event.altKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        editor.clearSelection();
      } else if (["1", "2", "3", "4"].includes(event.key)) {
        const modes = {
          "1": "object",
          "2": "vertex",
          "3": "edge",
          "4": "face",
        } as const;
        editor.setSelectionMode(modes[event.key as keyof typeof modes]);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        editor.deleteSelectedObjects();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor]);
}
