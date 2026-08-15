import { useRef, type ChangeEvent } from "react";
import type { Editor } from "../editor/Editor";
import type { ModelObjectSnapshot } from "../editor/document/types";

function download(data: BlobPart, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useExchangeFiles(
  editor: Editor,
  objects: readonly ModelObjectSnapshot[],
  includeHidden: boolean,
  onError: (message: string) => void,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  return {
    inputRef,
    openPicker: () => inputRef.current?.click(),
    exportGlb: () =>
      void run(async () => {
        const { exportGlb } = await import("../editor/formats/exchangeFormats");
        download(
          await exportGlb(objects, includeHidden),
          "model/gltf-binary",
          "polygon-model.glb",
        );
      }),
    exportStl: () =>
      void run(async () => {
        const { exportStl } = await import("../editor/formats/exchangeFormats");
        download(
          exportStl(objects, includeHidden),
          "model/stl",
          "polygon-model.stl",
        );
      }),
    importFile: (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;
      void run(async () => {
        const { importGlb, importStl } =
          await import("../editor/formats/exchangeFormats");
        const data = await file.arrayBuffer();
        const isGlb =
          data.byteLength >= 4 &&
          new DataView(data).getUint32(0, true) === 0x46546c67;
        const imported = isGlb ? await importGlb(data) : importStl(data);
        editor.importMeshes(imported);
      });
    },
  };
}
