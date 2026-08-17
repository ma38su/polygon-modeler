import { useEffect } from "react";
import type { Editor } from "../../editor/Editor";
import { SELECTION_MODES } from "../../editor/selection/SelectionManager";
import type { TransformMode } from "../../viewport/Viewport";

interface ShortcutOptions {
  activateTransformMode(mode: TransformMode): void;
  showHelp(): void;
}

export function useEditorShortcuts(
  editor: Editor,
  { activateTransformMode, showHelp }: ShortcutOptions,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable=true]"))
        return;
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
      } else if (["1", "2", "3"].includes(event.key)) {
        const mode = SELECTION_MODES[Number(event.key) - 1];
        if (mode) editor.toggleSelectionMode(mode);
      } else if (event.key.toLowerCase() === "g") {
        activateTransformMode("translate");
      } else if (event.key.toLowerCase() === "r") {
        activateTransformMode("rotate");
      } else if (event.key.toLowerCase() === "s") {
        activateTransformMode("scale");
      } else if (event.key === "?") {
        showHelp();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        editor.deleteSelectedElements();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activateTransformMode, editor, showHelp]);
}
