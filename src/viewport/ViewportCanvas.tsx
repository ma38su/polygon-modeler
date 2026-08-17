import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  Viewport,
  type TransformCommitListener,
  type TransformMode,
  type ViewportStatus,
} from "./Viewport";
import type { ModelObjectSnapshot, ObjectId } from "../editor/document/types";
import type {
  SelectionItem,
  SelectionMode,
} from "../editor/selection/SelectionManager";
import type { DisplayLayers } from "./displayLayers";

export interface ViewportCanvasProps {
  onStatusChange(status: ViewportStatus): void;
  projection: "perspective" | "orthographic";
  objects: readonly ModelObjectSnapshot[];
  selectedObjectIds: ReadonlySet<ObjectId>;
  transformMode: TransformMode;
  onTransformCommit: TransformCommitListener;
  onElementTranslateCommit(
    delta: import("../editor/document/types").Vector3Value,
  ): void;
  selectionMode: SelectionMode;
  selectionModes: ReadonlySet<SelectionMode>;
  selectionItems: readonly SelectionItem[];
  displayLayers: DisplayLayers;
  onPick(item: SelectionItem | undefined, additive: boolean): void;
}

export function ViewportCanvas({
  onStatusChange,
  projection,
  objects,
  selectedObjectIds,
  transformMode,
  onTransformCommit,
  onElementTranslateCommit,
  selectionMode,
  selectionModes,
  selectionItems,
  displayLayers,
  onPick,
}: ViewportCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<Viewport>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const viewport = new Viewport(host, (status) => {
      setError(status.error);
      onStatusChange(status);
    });
    viewportRef.current = viewport;
    viewport.setTransformCommitListener(onTransformCommit);
    viewport.setElementTranslateCommitListener(onElementTranslateCommit);
    void viewport.initialize();
    return () => {
      viewportRef.current = null;
      viewport.dispose();
    };
  }, [onElementTranslateCommit, onStatusChange, onTransformCommit]);

  useEffect(() => viewportRef.current?.setProjection(projection), [projection]);
  useEffect(
    () =>
      viewportRef.current?.syncObjects(
        objects,
        selectedObjectIds,
        selectionModes,
        selectionItems,
        displayLayers,
      ),
    [
      displayLayers,
      objects,
      selectedObjectIds,
      selectionItems,
      selectionMode,
      selectionModes,
    ],
  );
  useEffect(
    () => viewportRef.current?.setPicking(selectionModes, onPick),
    [selectionModes, onPick],
  );
  useEffect(
    () => viewportRef.current?.setTransformMode(transformMode),
    [transformMode],
  );

  return (
    <div
      className="viewport-canvas"
      ref={hostRef}
      data-testid="viewport-canvas"
      data-selection-mode={selectionMode}
      data-selection-modes={[...selectionModes].join(",")}
      data-display-vertices={displayLayers.vertices}
      data-display-edges={displayLayers.edges}
      data-display-faces={displayLayers.faces}
      tabIndex={0}
      onPointerDown={(event) => event.currentTarget.focus()}
    >
      {error && (
        <div className="viewport-error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" />
            再読み込み
          </button>
        </div>
      )}
    </div>
  );
}
