import {
  Box,
  BoxIcon,
  Eye,
  EyeOff,
  Grid3X3,
  Magnet,
  Minus,
  Square,
  Waves,
} from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import {
  SELECTION_MODES,
  type SelectionMode,
} from "../../editor/selection/SelectionManager";
import type { DisplayLayers } from "../../viewport/displayLayers";
import type { AxisConstraint, SnapSettings } from "../../viewport/Viewport";
import type { TransformOrientation } from "../../viewport/transform/elementSelection";
import { Button } from "../primitives/Button";

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
  ["normals", "Normal", "法線"],
] as const;

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

function ToolbarButton({ active = false, ...props }: ToolbarButtonProps) {
  return (
    <Button
      size="sm"
      variant={active ? "accent" : "ghost"}
      aria-pressed={active}
      {...props}
    />
  );
}

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
          <ToolbarButton
            key={mode}
            active={selectionModes.has(mode)}
            title={selectionDescriptions[mode]}
            onClick={() => onToggleSelectionMode(mode)}
          >
            {selectionLabels[mode]}
          </ToolbarButton>
        ))}
      </div>
      <div className="display-layer-bar" aria-label="表示レイヤー">
        <span>表示</span>
        {displayLayerOptions.map(([layer, label, japaneseLabel]) => {
          const visible = displayLayers[layer];
          const VisibilityIcon =
            layer === "normals" ? Waves : visible ? Eye : EyeOff;
          return (
            <ToolbarButton
              key={layer}
              active={visible}
              title={`${japaneseLabel}を${visible ? "非表示" : "表示"}`}
              onClick={() => onToggleDisplayLayer(layer)}
            >
              <VisibilityIcon aria-hidden="true" />
              {label}
            </ToolbarButton>
          );
        })}
      </div>
      <div className="viewport-toolbar" aria-label="ビューポート設定">
        <ToolbarButton
          active={projection === "perspective"}
          onClick={() => onProjectionChange("perspective")}
        >
          <BoxIcon aria-hidden="true" />
          透視
        </ToolbarButton>
        <ToolbarButton
          active={projection === "orthographic"}
          onClick={() => onProjectionChange("orthographic")}
        >
          <Box aria-hidden="true" />
          正投影
        </ToolbarButton>
      </div>
      <div className="snap-toolbar" aria-label="スナップと軸制限">
        <div className="snap-toolbar-group" role="group" aria-label="操作座標">
          <span className="snap-toolbar-label">操作座標</span>
          {(["world", "local", "normal"] as const).map((orientation) => (
            <ToolbarButton
              key={orientation}
              active={transformOrientation === orientation}
              title={
                {
                  world: "ワールド座標軸で変形",
                  local: "オブジェクトのローカル座標軸で変形",
                  normal: "選択要素の法線を基準に変形",
                }[orientation]
              }
              onClick={() => onTransformOrientationChange(orientation)}
            >
              {
                { world: "ワールド", local: "ローカル", normal: "法線" }[
                  orientation
                ]
              }
            </ToolbarButton>
          ))}
        </div>
        <div
          className="snap-toolbar-group"
          role="group"
          aria-label="スナップ先"
        >
          <span className="snap-toolbar-label">スナップ</span>
          <ToolbarButton
            active={snapSettings.grid}
            title={`グリッドへ${snapSettings.gridSize}単位で吸着`}
            onClick={() =>
              onSnapSettingsChange({
                ...snapSettings,
                grid: !snapSettings.grid,
              })
            }
          >
            <Grid3X3 aria-hidden="true" />
            グリッド
          </ToolbarButton>
          <ToolbarButton
            active={snapSettings.vertex}
            title="未選択の頂点へ吸着"
            onClick={() =>
              onSnapSettingsChange({
                ...snapSettings,
                vertex: !snapSettings.vertex,
              })
            }
          >
            <Magnet aria-hidden="true" />
            頂点
          </ToolbarButton>
          <ToolbarButton
            active={snapSettings.edge}
            title="未選択の辺の中点へ吸着"
            onClick={() =>
              onSnapSettingsChange({
                ...snapSettings,
                edge: !snapSettings.edge,
              })
            }
          >
            <Minus aria-hidden="true" />
            辺中央
          </ToolbarButton>
          <ToolbarButton
            active={snapSettings.face}
            title="未選択の面の中心へ吸着"
            onClick={() =>
              onSnapSettingsChange({
                ...snapSettings,
                face: !snapSettings.face,
              })
            }
          >
            <Square aria-hidden="true" />
            面中央
          </ToolbarButton>
        </div>
        <div
          className="snap-toolbar-group"
          role="group"
          aria-label="移動軸制限"
        >
          <span className="snap-toolbar-label">軸制限</span>
          {(["x", "y", "z"] as const).map((axis) => (
            <ToolbarButton
              key={axis}
              active={axisConstraint === axis}
              title={`${axis.toUpperCase()}軸だけに移動を制限`}
              onClick={() =>
                onAxisConstraintChange(axisConstraint === axis ? "all" : axis)
              }
            >
              {axis.toUpperCase()}
            </ToolbarButton>
          ))}
        </div>
      </div>
    </>
  );
}
