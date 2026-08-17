import { useRef, useState, type ChangeEvent } from "react";
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
  importSettings: { unit: "meter" | "millimeter"; upAxis: "y" | "z" },
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController>(undefined);
  const [importProgress, setImportProgress] = useState<number>();
  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setImportProgress(undefined);
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
    exportObj: () =>
      void run(async () => {
        const { exportObj } = await import("../editor/formats/exchangeFormats");
        download(
          exportObj(objects, includeHidden),
          "text/plain;charset=utf-8",
          "polygon-model.obj",
        );
      }),
    importFile: (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;
      void run(async () => {
        const controller = new AbortController();
        abortRef.current?.abort();
        abortRef.current = controller;
        setImportProgress(0);
        const data = await readFile(file, controller.signal, setImportProgress);
        const { importGlb, importStl } =
          await import("../editor/formats/exchangeFormats");
        if (file.name.toLowerCase().endsWith(".obj")) {
          const { importObj } =
            await import("../editor/formats/exchangeFormats");
          const imported = importObj(
            new TextDecoder().decode(data),
            importSettings.unit === "millimeter" ? 0.001 : 1,
          );
          orientImported(imported, importSettings.upAxis);
          editor.importMeshes(imported);
          setImportProgress(undefined);
          return;
        }
        const isGlb =
          data.byteLength >= 4 &&
          new DataView(data).getUint32(0, true) === 0x46546c67;
        const imported = isGlb
          ? await importGlb(data)
          : importStl(data, importSettings.unit === "millimeter" ? 0.001 : 1);
        orientImported(imported, importSettings.upAxis);
        editor.importMeshes(imported);
        setImportProgress(undefined);
      });
    },
    importProgress,
    cancelImport: () => {
      abortRef.current?.abort();
      setImportProgress(undefined);
    },
  };
}

async function readFile(
  file: File,
  signal: AbortSignal,
  onProgress: (value: number) => void,
): Promise<ArrayBuffer> {
  const reader = file.stream().getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      if (signal.aborted)
        throw new DOMException("読み込みをキャンセルしました", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      onProgress(file.size ? received / file.size : 0);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(received);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return result.buffer;
}

function orientImported(
  imported: readonly import("../editor/formats/exchangeFormats").ImportedMesh[],
  upAxis: "y" | "z",
): void {
  if (upAxis === "y") return;
  imported.forEach(({ mesh }) =>
    mesh.transformVertices(new Set(mesh.vertices.keys()), (point) => ({
      x: point.x,
      y: point.z,
      z: -point.y,
    })),
  );
}
