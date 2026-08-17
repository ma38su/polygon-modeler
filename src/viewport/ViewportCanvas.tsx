import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  Viewport,
  type AxisConstraint,
  type ElementTransformCommitListener,
  type SnapSettings,
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
import type { RegionShape, ScreenPoint } from "./picking/RegionPicker";

export type SelectionGesture = "click" | RegionShape;

export interface ViewportCanvasProps {
  onStatusChange(status: ViewportStatus): void;
  projection: "perspective" | "orthographic";
  objects: readonly ModelObjectSnapshot[];
  selectedObjectIds: ReadonlySet<ObjectId>;
  transformMode: TransformMode;
  onTransformCommit: TransformCommitListener;
  onElementTransformCommit: ElementTransformCommitListener;
  selectionModes: ReadonlySet<SelectionMode>;
  selectionItems: readonly SelectionItem[];
  displayLayers: DisplayLayers;
  onPick(item: SelectionItem | undefined, additive: boolean): void;
  selectionGesture: SelectionGesture;
  onPickRegion(items: readonly SelectionItem[], additive: boolean): void;
  axisConstraint: AxisConstraint;
  snapSettings: SnapSettings;
  modelingPreviewActive: boolean;
  geometryEpoch: number;
}

export function ViewportCanvas({
  onStatusChange,
  projection,
  objects,
  selectedObjectIds,
  transformMode,
  onTransformCommit,
  onElementTransformCommit,
  selectionModes,
  selectionItems,
  displayLayers,
  onPick,
  selectionGesture,
  onPickRegion,
  axisConstraint,
  snapSettings,
  modelingPreviewActive,
  geometryEpoch,
}: ViewportCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<Viewport>(null);
  const [error, setError] = useState<string>();
  const [regionPoints, setRegionPoints] = useState<ScreenPoint[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const viewport = new Viewport(host, (status) => {
      setError(status.error);
      onStatusChange(status);
    });
    viewportRef.current = viewport;
    viewport.setTransformCommitListener(onTransformCommit);
    viewport.setElementTransformCommitListener(onElementTransformCommit);
    void viewport.initialize();
    return () => {
      viewportRef.current = null;
      viewport.dispose();
    };
  }, [onElementTransformCommit, onStatusChange, onTransformCommit]);

  useEffect(() => viewportRef.current?.setProjection(projection), [projection]);
  useEffect(
    () =>
      viewportRef.current?.syncObjects(
        objects,
        selectedObjectIds,
        selectionModes,
        selectionItems,
        displayLayers,
        geometryEpoch,
      ),
    [
      displayLayers,
      geometryEpoch,
      objects,
      selectedObjectIds,
      selectionItems,
      selectionModes,
    ],
  );
  useEffect(
    () => viewportRef.current?.setAxisConstraint(axisConstraint),
    [axisConstraint],
  );
  useEffect(
    () => viewportRef.current?.setSnapSettings(snapSettings),
    [snapSettings],
  );
  useEffect(
    () => viewportRef.current?.setPicking(selectionModes, onPick),
    [selectionModes, onPick],
  );
  useEffect(
    () => viewportRef.current?.setTransformMode(transformMode),
    [transformMode],
  );
  useEffect(
    () =>
      viewportRef.current?.setTransformInteractionBlocked(
        selectionGesture !== "click" || modelingPreviewActive,
      ),
    [modelingPreviewActive, selectionGesture],
  );

  return (
    <div
      className="viewport-canvas"
      ref={hostRef}
      data-testid="viewport-canvas"
      data-selection-modes={[...selectionModes].join(",")}
      data-display-vertices={displayLayers.vertices}
      data-display-edges={displayLayers.edges}
      data-display-faces={displayLayers.faces}
      data-selection-gesture={selectionGesture}
      data-axis-constraint={axisConstraint}
      data-grid-snap={snapSettings.grid}
      data-vertex-snap={snapSettings.vertex}
      data-edge-snap={snapSettings.edge}
      data-face-snap={snapSettings.face}
      data-modeling-preview={modelingPreviewActive}
      tabIndex={0}
      onPointerDown={(event) => event.currentTarget.focus()}
      onPointerDownCapture={(event) => {
        if (selectionGesture === "click" || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const bounds = event.currentTarget.getBoundingClientRect();
        setRegionPoints([
          { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
        ]);
      }}
      onPointerMoveCapture={(event) => {
        if (selectionGesture === "click" || regionPoints.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const bounds = event.currentTarget.getBoundingClientRect();
        const point = {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        };
        setRegionPoints((current) =>
          selectionGesture === "box"
            ? [current[0]!, point]
            : [...current, point],
        );
      }}
      onPointerUpCapture={(event) => {
        if (selectionGesture === "click" || regionPoints.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const bounds = event.currentTarget.getBoundingClientRect();
        const clientPoints = regionPoints.map((point) => ({
          x: point.x + bounds.left,
          y: point.y + bounds.top,
        }));
        onPickRegion(
          viewportRef.current?.pickRegion(clientPoints, selectionGesture) ?? [],
          event.shiftKey,
        );
        setRegionPoints([]);
      }}
    >
      {selectionGesture !== "click" && regionPoints.length > 0 && (
        <svg className="selection-region" aria-hidden="true">
          {selectionGesture === "box" ? (
            <rect
              x={Math.min(regionPoints[0]!.x, regionPoints.at(-1)!.x)}
              y={Math.min(regionPoints[0]!.y, regionPoints.at(-1)!.y)}
              width={Math.abs(regionPoints.at(-1)!.x - regionPoints[0]!.x)}
              height={Math.abs(regionPoints.at(-1)!.y - regionPoints[0]!.y)}
            />
          ) : (
            <polyline
              points={regionPoints
                .map((point) => `${point.x},${point.y}`)
                .join(" ")}
            />
          )}
        </svg>
      )}
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
