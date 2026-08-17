import {
  Box,
  BoxIcon,
  Eye,
  EyeOff,
  Grid3X3,
  Magnet,
  Minus,
  Square,
} from "lucide-react";
import {
  SELECTION_MODES,
  type SelectionMode,
} from "../../editor/selection/SelectionManager";
import type { DisplayLayers } from "../../viewport/displayLayers";
import type { AxisConstraint, SnapSettings } from "../../viewport/Viewport";
import type { TransformOrientation } from "../../viewport/transform/elementSelection";

const selectionLabels: Record<SelectionMode, string> = {
  vertex: "Vertex",
  edge: "Edge",
  face: "Face",
};

const selectionDescriptions: Record<SelectionMode, string> = {
  vertex: "頂点を選択（Shiftで複数選択）",
  edge: "辺を選択（Shiftで複数選択）",
  face: "面を選択（Shiftで複数選択）",
};

const displayLayerOptions = [
  ["vertices", "Vertex", "頂点"],
  ["edges", "Edge", "辺"],
  ["faces", "Face", "面"],
] as const;

interface ViewportControlsProps {
  selectionModes: ReadonlySet<SelectionMode>;
  onToggleSelectionMode(mode: SelectionMode): void;
  displayLayers: DisplayLayers;
  onToggleDisplayLayer(layer: keyof DisplayLayers): void;
  projection: "perspective" | "orthographic";
  onProjectionChange(projection: "perspective" | "orthographic"): void;
  axisConstraint: AxisConstraint;
  transformOrientation: TransformOrientation;
  onTransformOrientationChange(orientation: TransformOrientation): void;
  onAxisConstraintChange(constraint: AxisConstraint): void;
  snapSettings: SnapSettings;
  onSnapSettingsChange(settings: SnapSettings): void;
}

export function ViewportControls({
  selectionModes,
  onToggleSelectionMode,
  displayLayers,
  onToggleDisplayLayer,
  projection,
  onProjectionChange,
  axisConstraint,
  transformOrientation,
  onTransformOrientationChange,
  onAxisConstraintChange,
  snapSettings,
  onSnapSettingsChange,
}: ViewportControlsProps) {
  return (
    <>
      <div className="selection-mode-bar" aria-label="選択モード">
        {SELECTION_MODES.map((mode) => (
          <button
            type="button"
            key={mode}
            className={selectionModes.has(mode) ? "active" : ""}
            aria-pressed={selectionModes.has(mode)}
            title={selectionDescriptions[mode]}
            onClick={() => onToggleSelectionMode(mode)}
          >
            {selectionLabels[mode]}
          </button>
        ))}
      </div>
      <div className="selection-mode-hint" aria-live="polite">
        Vertex → Edge → Faceの順に判定 / Shiftで追加選択
      </div>
      <div className="display-layer-bar" aria-label="表示レイヤー">
        <span>表示</span>
        {displayLayerOptions.map(([layer, label, japaneseLabel]) => {
          const visible = displayLayers[layer];
          const VisibilityIcon = visible ? Eye : EyeOff;
          return (
            <button
              type="button"
              key={layer}
              className={visible ? "active" : ""}
              aria-pressed={visible}
              title={`${japaneseLabel}を${visible ? "非表示" : "表示"}`}
              onClick={() => onToggleDisplayLayer(layer)}
            >
              <VisibilityIcon aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
      <div className="viewport-toolbar" aria-label="ビューポート設定">
        <button
          type="button"
          className={projection === "perspective" ? "active" : ""}
          onClick={() => onProjectionChange("perspective")}
        >
          <BoxIcon aria-hidden="true" />
          透視
        </button>
        <button
          type="button"
          className={projection === "orthographic" ? "active" : ""}
          onClick={() => onProjectionChange("orthographic")}
        >
          <Box aria-hidden="true" />
          正投影
        </button>
      </div>
      <div className="snap-toolbar" aria-label="スナップと軸制限">
        <span>座標</span>
        {(["world", "local", "normal"] as const).map((orientation) => (
          <button
            type="button"
            key={orientation}
            className={transformOrientation === orientation ? "active" : ""}
            aria-pressed={transformOrientation === orientation}
            onClick={() => onTransformOrientationChange(orientation)}
          >
            {{ world: "World", local: "Local", normal: "Normal" }[orientation]}
          </button>
        ))}
        <button
          type="button"
          className={snapSettings.grid ? "active" : ""}
          aria-pressed={snapSettings.grid}
          title={`グリッドへ${snapSettings.gridSize}単位でスナップ`}
          onClick={() =>
            onSnapSettingsChange({
              ...snapSettings,
              grid: !snapSettings.grid,
            })
          }
        >
          <Grid3X3 aria-hidden="true" />
          Grid
        </button>
        <button
          type="button"
          className={snapSettings.vertex ? "active" : ""}
          aria-pressed={snapSettings.vertex}
          title="未選択の頂点へスナップ"
          onClick={() =>
            onSnapSettingsChange({
              ...snapSettings,
              vertex: !snapSettings.vertex,
            })
          }
        >
          <Magnet aria-hidden="true" />
          Vertex
        </button>
        <button
          type="button"
          className={snapSettings.edge ? "active" : ""}
          aria-pressed={snapSettings.edge}
          title="未選択の辺の中点へスナップ"
          onClick={() =>
            onSnapSettingsChange({
              ...snapSettings,
              edge: !snapSettings.edge,
            })
          }
        >
          <Minus aria-hidden="true" />
          Edge
        </button>
        <button
          type="button"
          className={snapSettings.face ? "active" : ""}
          aria-pressed={snapSettings.face}
          title="未選択の面の中心へスナップ"
          onClick={() =>
            onSnapSettingsChange({
              ...snapSettings,
              face: !snapSettings.face,
            })
          }
        >
          <Square aria-hidden="true" />
          Face
        </button>
        <span>軸</span>
        {(["x", "y", "z"] as const).map((axis) => (
          <button
            type="button"
            key={axis}
            className={axisConstraint === axis ? "active" : ""}
            aria-pressed={axisConstraint === axis}
            title={`${axis.toUpperCase()}軸に制限`}
            onClick={() =>
              onAxisConstraintChange(axisConstraint === axis ? "all" : axis)
            }
          >
            {axis.toUpperCase()}
          </button>
        ))}
      </div>
    </>
  );
}
