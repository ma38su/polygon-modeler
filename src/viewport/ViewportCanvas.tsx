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

export interface ViewportCanvasProps {
  onStatusChange(status: ViewportStatus): void;
  projection: "perspective" | "orthographic";
  objects: readonly ModelObjectSnapshot[];
  selectedObjectIds: ReadonlySet<ObjectId>;
  transformMode: TransformMode;
  onTransformCommit: TransformCommitListener;
  selectionMode: SelectionMode;
  onPick(item: SelectionItem | undefined, additive: boolean): void;
}

export function ViewportCanvas({
  onStatusChange,
  projection,
  objects,
  selectedObjectIds,
  transformMode,
  onTransformCommit,
  selectionMode,
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
    void viewport.initialize();
    return () => {
      viewportRef.current = null;
      viewport.dispose();
    };
  }, [onStatusChange, onTransformCommit]);

  useEffect(() => viewportRef.current?.setProjection(projection), [projection]);
  useEffect(
    () => viewportRef.current?.syncObjects(objects, selectedObjectIds),
    [objects, selectedObjectIds],
  );
  useEffect(
    () => viewportRef.current?.setPicking(selectionMode, onPick),
    [selectionMode, onPick],
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
