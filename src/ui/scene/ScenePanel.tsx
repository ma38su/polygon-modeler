import { useMemo, useState } from "react";
import {
  Blend,
  Box,
  Combine,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal2,
  GitMerge,
  Minus,
  RefreshCw,
  Expand,
  Move3D,
  Rotate3D,
} from "lucide-react";
import type { BooleanOperation } from "../../editor/boolean/booleanOperations";
import type { Editor } from "../../editor/Editor";
import type { EditorSnapshot } from "../../editor/document/types";
import { ElementTransformPanel } from "../inspector/ElementTransformPanel";
import { TransformInspector } from "../inspector/TransformInspector";
import { MaterialInspector } from "../inspector/MaterialInspector";
import { diagnoseMesh } from "../../editor/mesh/meshDiagnostics";
import type {
  NormalHandleOperation,
  TransformMode,
} from "../../viewport/Viewport";
import type { TransformOrientation } from "../../viewport/transform/elementSelection";
import type { LightingSettings } from "../../viewport/Viewport";
import { LightingPanel } from "../inspector/LightingPanel";
import { ModifierPanel } from "../inspector/ModifierPanel";
import { Button } from "../primitives/Button";
import { ControlGroup } from "../primitives/ControlGroup";

interface ScenePanelProps {
  editor: Editor;
  snapshot: EditorSnapshot;
  onError(message: string): void;
  onModelingPreview(objects?: EditorSnapshot["objects"]): void;
  transformMode?: TransformMode;
  transformOrientation: TransformOrientation;
  onTransformModeChange(mode: TransformMode): void;
  normalOperation?: NormalHandleOperation;
  onNormalOperationChange(operation: NormalHandleOperation): void;
  lightingSettings: LightingSettings;
  onLightingSettingsChange(value: LightingSettings): void;
  knifeActive: boolean;
  onKnifeActiveChange(active: boolean): void;
}

export function ScenePanel({
  editor,
  snapshot,
  onError,
  onModelingPreview,
  transformMode,
  transformOrientation,
  onTransformModeChange,
  normalOperation,
  onNormalOperationChange,
  lightingSettings,
  onLightingSettingsChange,
  knifeActive,
  onKnifeActiveChange,
}: ScenePanelProps) {
  const [booleanPending, setBooleanPending] = useState(false);
  const [mergeDistance, setMergeDistance] = useState(0.0001);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const selectedObject = snapshot.objects.find((object) =>
    snapshot.selectedObjectIds.has(object.id),
  );
  const selectedObjects = snapshot.objects.filter((object) =>
    snapshot.selectedObjectIds.has(object.id),
  );
  const diagnostics = useMemo(
    () => (selectedObject ? diagnoseMesh(selectedObject.mesh) : undefined),
    // Snapshots may be recreated for selection/UI changes while mesh data is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedObject?.id, selectedObject?.mesh.revision],
  );
  const selectedElementKinds = snapshot.selectionItems.reduce((kinds, item) => {
    const object = snapshot.objects.find(
      (candidate) => candidate.id === item.objectId,
    );
    if (object?.mesh.faceIds.some((id) => id === item.elementId))
      kinds.add("face");
    if (object?.mesh.edges.some((edge) => edge.id === item.elementId))
      kinds.add("edge");
    return kinds;
  }, new Set<"edge" | "face">());
  const runAction = (action: () => void) => {
    try {
      action();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  const runBoolean = async (operation: BooleanOperation) => {
    setBooleanPending(true);
    try {
      await editor.booleanSelectedObjects(operation);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBooleanPending(false);
    }
  };

  return (
    <aside className="side-panel">
      <section aria-labelledby="outliner-title">
        <h2 id="outliner-title">オブジェクト</h2>
        {snapshot.objects.length === 0 ? (
          <div className="empty-state">
            <Box aria-hidden="true" />
            シーンは空です
          </div>
        ) : (
          <ul className="object-list">
            {snapshot.objects.map((object) => (
              <li
                className={
                  snapshot.selectedObjectIds.has(object.id) ? "selected" : ""
                }
                key={object.id}
              >
                <button
                  type="button"
                  className="object-select"
                  onClick={(event) =>
                    editor.selectObject(object.id, event.shiftKey)
                  }
                >
                  <Box aria-hidden="true" />
                  {object.name}
                </button>
                <button
                  type="button"
                  className="visibility-toggle"
                  aria-label={`${object.name}を${object.visible ? "非表示" : "表示"}`}
                  onClick={() =>
                    editor.setObjectVisible(object.id, !object.visible)
                  }
                >
                  {object.visible ? (
                    <Eye aria-hidden="true" />
                  ) : (
                    <EyeOff aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 space-y-3" aria-label="オブジェクト操作">
          <ControlGroup label="基本操作">
            <Button
              disabled={snapshot.selectedObjectIds.size === 0}
              title="選択したオブジェクトのコピーを作成"
              icon={<Copy className="size-4" aria-hidden="true" />}
              onClick={() => editor.duplicateSelectedObjects()}
            >
              複製
            </Button>
            <Button
              disabled={snapshot.selectedObjectIds.size < 2}
              title="2個以上の選択オブジェクトを1個に結合"
              icon={<Combine className="size-4" aria-hidden="true" />}
              onClick={() => editor.joinSelectedObjects()}
            >
              結合
            </Button>
          </ControlGroup>
          <ControlGroup label="ミラー複製" columns={3}>
            {(["x", "y", "z"] as const).map((axis) => (
              <Button
                key={axis}
                className="px-1.5"
                disabled={snapshot.selectedObjectIds.size === 0}
                title={`${axis.toUpperCase()}軸で反転したコピーを作成`}
                icon={<FlipHorizontal2 className="size-4" aria-hidden="true" />}
                onClick={() => editor.mirrorSelectedObjects(axis)}
              >
                {axis.toUpperCase()}軸
              </Button>
            ))}
          </ControlGroup>
          <ControlGroup label="ブーリアン演算（2個選択）" columns={3}>
            {(
              [
                ["union", "和", "Union", GitMerge],
                ["subtract", "差", "Subtract", Minus],
                ["intersect", "積", "Intersect", Blend],
              ] as const
            ).map(([operation, label, accessibleLabel, Icon]) => (
              <Button
                aria-label={accessibleLabel}
                key={operation}
                className="px-1.5"
                disabled={
                  booleanPending || snapshot.selectedObjectIds.size !== 2
                }
                icon={<Icon className="size-4" aria-hidden="true" />}
                title={
                  {
                    union: "2個の形状を足し合わせる（和）",
                    subtract: "先の形状から後の形状を切り取る（差）",
                    intersect: "2個の形状が重なる部分だけを残す（積）",
                  }[operation]
                }
                onClick={() => void runBoolean(operation)}
              >
                {booleanPending ? "演算中…" : label}
              </Button>
            ))}
          </ControlGroup>
        </div>
      </section>
      <section aria-labelledby="inspector-title">
        <h2 id="inspector-title">インスペクター</h2>
        <LightingPanel
          value={lightingSettings}
          onChange={onLightingSettingsChange}
        />
        {(selectedObject || snapshot.selectionItems.length > 0) && (
          <div className="mb-3 grid grid-cols-3 gap-1" aria-label="変形ツール">
            {(
              [
                ["translate", "移動", Move3D],
                ["rotate", "回転", Rotate3D],
                ["scale", "拡大縮小", Expand],
              ] as const
            ).map(([mode, label, Icon]) => (
              <Button
                size="sm"
                variant={transformMode === mode ? "accent" : "default"}
                aria-pressed={transformMode === mode}
                icon={<Icon className="size-3.5" aria-hidden="true" />}
                onClick={() => onTransformModeChange(mode)}
                key={mode}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
        {snapshot.selectionItems.length ? (
          <ElementTransformPanel
            editor={editor}
            onError={onError}
            onPreview={onModelingPreview}
            normalOperation={normalOperation}
            onNormalOperationChange={onNormalOperationChange}
            canExtrude={selectedElementKinds.has("face")}
            canNormalMove={
              selectedElementKinds.has("face") ||
              selectedElementKinds.has("edge")
            }
            transformOrientation={transformOrientation}
            knifeActive={knifeActive}
            onKnifeActiveChange={onKnifeActiveChange}
            object={selectedObject}
          />
        ) : selectedObject ? (
          <>
            <TransformInspector
              editor={editor}
              objects={selectedObjects}
              orientation={transformOrientation}
            />
            <MaterialInspector editor={editor} object={selectedObject} />
            <ModifierPanel editor={editor} object={selectedObject} />
            <div className="mesh-diagnostics" aria-label="メッシュ診断">
              <h3>メッシュ診断</h3>
              <dl>
                <div>
                  <dt>状態</dt>
                  <dd>
                    {diagnostics!.healthy
                      ? diagnostics!.inverted
                        ? "警告・面が内向き"
                        : diagnostics!.closed
                          ? "正常・閉じた立体"
                          : "正常・開いたサーフェス"
                      : "要修復"}
                  </dd>
                </div>
                <div>
                  <dt>境界Edge</dt>
                  <dd>{diagnostics!.boundaryEdges}</dd>
                </div>
                <div>
                  <dt>非manifold</dt>
                  <dd>{diagnostics!.nonManifoldEdges}</dd>
                </div>
                <div>
                  <dt>退化Face</dt>
                  <dd>{diagnostics!.degenerateFaces}</dd>
                </div>
                <div>
                  <dt>孤立Vertex</dt>
                  <dd>{diagnostics!.isolatedVertices}</dd>
                </div>
              </dl>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <Button
                  size="sm"
                  icon={<Combine className="size-3.5" aria-hidden="true" />}
                  onClick={() => setShowMergeDialog(true)}
                >
                  Merge by Distance
                </Button>
                <Button
                  size="sm"
                  icon={<RefreshCw className="size-3.5" aria-hidden="true" />}
                  onClick={() =>
                    runAction(() => editor.recalculateSelectedObjectNormals())
                  }
                >
                  法線再計算
                </Button>
              </div>
              {showMergeDialog && (
                <div className="dialog-backdrop" role="presentation">
                  <section
                    className="shortcut-dialog exchange-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="merge-dialog-title"
                  >
                    <header>
                      <h2 id="merge-dialog-title">Merge by Distance</h2>
                      <button
                        type="button"
                        onClick={() => setShowMergeDialog(false)}
                      >
                        閉じる
                      </button>
                    </header>
                    <p>指定距離以内にある頂点を一つに統合します。</p>
                    <div className="exchange-options">
                      <label>
                        <span>Merge距離</span>
                        <input
                          aria-label="Merge距離"
                          type="number"
                          min="0.000001"
                          step="0.0001"
                          value={mergeDistance}
                          onChange={(event) =>
                            setMergeDistance(Number(event.currentTarget.value))
                          }
                        />
                      </label>
                    </div>
                    <div className="dialog-actions">
                      <button
                        type="button"
                        onClick={() => setShowMergeDialog(false)}
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            editor.mergeSelectedObjectsByDistance(
                              mergeDistance,
                            );
                            setShowMergeDialog(false);
                          } catch (error) {
                            onError(
                              error instanceof Error
                                ? error.message
                                : String(error),
                            );
                          }
                        }}
                      >
                        実行
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">オブジェクトを選択してください</div>
        )}
      </section>
    </aside>
  );
}
