import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { Editor } from "../editor/Editor";
import {
  clearAutosave,
  loadAutosave,
  saveAutosave,
} from "../storage/projectStorage";

export function useProjectPersistence(
  editor: Editor,
  revision: number,
  isDirty: boolean,
  onError: (message: string) => void,
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recoverySource, setRecoverySource] = useState<string>();

  useEffect(() => {
    void loadAutosave()
      .then(setRecoverySource)
      .catch((error) =>
        onError(error instanceof Error ? error.message : String(error)),
      );
  }, [onError]);

  useEffect(() => {
    if (!isDirty) return;
    const timer = window.setTimeout(() => {
      void saveAutosave(editor.serializeProject()).catch((error) =>
        onError(error instanceof Error ? error.message : String(error)),
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [editor, isDirty, onError, revision]);

  const saveFile = useCallback(() => {
    const source = editor.serializeProject();
    const url = URL.createObjectURL(
      new Blob([source], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "polygon-model.polyproj";
    anchor.click();
    URL.revokeObjectURL(url);
    editor.markSaved();
    void clearAutosave();
  }, [editor]);

  const openFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;
      try {
        editor.loadProject(await file.text());
        setRecoverySource(undefined);
        await clearAutosave();
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error));
      }
    },
    [editor, onError],
  );

  const restoreAutosave = useCallback(() => {
    if (!recoverySource) return;
    try {
      editor.loadProject(recoverySource);
      setRecoverySource(undefined);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
      setRecoverySource(undefined);
    }
  }, [editor, onError, recoverySource]);

  const discardAutosave = useCallback(() => {
    setRecoverySource(undefined);
    void clearAutosave();
  }, []);

  return {
    fileInputRef,
    recoverySource,
    saveFile,
    openFile,
    openFilePicker: () => fileInputRef.current?.click(),
    restoreAutosave,
    discardAutosave,
  };
}
