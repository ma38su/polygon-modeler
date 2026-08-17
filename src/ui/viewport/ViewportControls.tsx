import { Box, BoxIcon, Eye, EyeOff } from "lucide-react";
import {
  SELECTION_MODES,
  type SelectionMode,
} from "../../editor/selection/SelectionManager";
import type { DisplayLayers } from "../../viewport/displayLayers";

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
}

export function ViewportControls({
  selectionModes,
  onToggleSelectionMode,
  displayLayers,
  onToggleDisplayLayer,
  projection,
  onProjectionChange,
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
    </>
  );
}
