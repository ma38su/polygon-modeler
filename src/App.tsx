import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelObjectSnapshot } from "./editor/document/types";
import {
  AlertCircle,
  Box,
  BoxSelect,
  ChevronDown,
  CircleGauge,
  CheckCircle2,
  FileDown,
  FolderOpen,
  HelpCircle,
  Import,
  LassoSelect,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Trash2,
  Upload,
  Undo2,
} from "lucide-react";
import { ViewportCanvas } from "./viewport/ViewportCanvas";
import type { SelectionGesture } from "./viewport/ViewportCanvas";
import {
  DEFAULT_LIGHTING_SETTINGS,
  type LightingSettings,
  type KnifePoint,
  type ViewportStatus,
} from "./viewport/Viewport";
import type {
  AxisConstraint,
  NormalHandleOperation,
  SnapSettings,
  TransformMode,
} from "./viewport/Viewport";
import type { TransformOrientation } from "./viewport/transform/elementSelection";
import {
  DEFAULT_DISPLAY_LAYERS,
  type DisplayLayers,
} from "./viewport/displayLayers";
import { useEditor, useEditorSnapshot } from "./app/useEditor";
import { useEditorShortcuts } from "./app/shortcuts/useEditorShortcuts";
import { ViewportControls } from "./ui/viewport/ViewportControls";
import { ScenePanel } from "./ui/scene/ScenePanel";
import { useProjectPersistence } from "./app/useProjectPersistence";
import { useExchangeFiles } from "./app/useExchangeFiles";
import "./App.css";

type Capability = "checking" | "webgpu" | "webgl2" | "unsupported";
const labels: Record<Capability, string> = {
  checking: "描画環境を確認中",
  webgpu: "WebGPU 対応",
  webgl2: "WebGL 2 フォールバック",
  unsupported: "3D 描画非対応",
};

export default function App() {
  const editor = useEditor();
  const snapshot = useEditorSnapshot();
  const [capability, setCapability] = useState<Capability>("checking");
  const [projection, setProjection] = useState<"perspective" | "orthographic">(
    "perspective",
  );
  const [transformMode, setTransformMode] = useState<TransformMode>();
  const [normalOperation, setNormalOperation] =
    useState<NormalHandleOperation>();
  const [normalHandleDistance, setNormalHandleDistance] = useState(0);
  const [selectionGesture, setSelectionGesture] =
    useState<SelectionGesture>("click");
  const [axisConstraint, setAxisConstraint] = useState<AxisConstraint>("all");
  const [transformOrientation, setTransformOrientation] =
    useState<TransformOrientation>("world");
  const [snapSettings, setSnapSettings] = useState<SnapSettings>({
    grid: false,
    vertex: false,
    edge: false,
    face: false,
    gridSize: 0.5,
  });
  const [displayLayers, setDisplayLayers] = useState<DisplayLayers>({
    ...DEFAULT_DISPLAY_LAYERS,
  });
  const [lightingSettings, setLightingSettings] = useState<LightingSettings>({
    ...DEFAULT_LIGHTING_SETTINGS,
  });
  const [knifeActive, setKnifeActive] = useState(false);
  const [knifeStart, setKnifeStart] = useState<KnifePoint>();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<"glb" | "stl" | "obj">();
  const [includeHidden, setIncludeHidden] = useState(false);
  const [importSettings, setImportSettings] = useState<{
    unit: "meter" | "millimeter";
    upAxis: "y" | "z";
  }>({ unit: "meter", upAxis: "y" });
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const [modelingPreview, setModelingPreview] =
    useState<readonly ModelObjectSnapshot[]>();
  const [geometryEpoch, setGeometryEpoch] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number }>();
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const normalPreviewFrameRef = useRef<number | undefined>(undefined);
  const openShortcutHelp = useCallback(() => setShowShortcuts(true), []);
  const activateTransformMode = useCallback((mode: TransformMode) => {
    setTransformMode(mode);
  }, []);
  const persistence = useProjectPersistence(
    editor,
    snapshot.revision,
    snapshot.isDirty,
    setErrorMessage,
  );
  const exchange = useExchangeFiles(
    editor,
    snapshot.objects,
    includeHidden,
    setErrorMessage,
    importSettings,
    (message) => {
      setSuccessMessage(message);
      setShowImportDialog(false);
      setExportFormat(undefined);
    },
  );
  useEditorShortcuts(editor, {
    activateTransformMode,
    setAxisConstraint,
    showHelp: openShortcutHelp,
  });
  useEffect(() => {
    if (contextMenu) contextMenuRef.current?.focus();
  }, [contextMenu]);
  useEffect(() => {
    if (!errorMessage) return;
    const timer = window.setTimeout(() => setErrorMessage(undefined), 5000);
    return () => window.clearTimeout(timer);
  }, [errorMessage]);
  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(undefined), 5000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);
  useEffect(() => {
    if (!normalOperation) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (normalPreviewFrameRef.current !== undefined)
        cancelAnimationFrame(normalPreviewFrameRef.current);
      normalPreviewFrameRef.current = undefined;
      setNormalOperation(undefined);
      setNormalHandleDistance(0);
      setModelingPreview(undefined);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [normalOperation]);
  const handleViewportStatus = useCallback((status: ViewportStatus) => {
    setCapability(
      status.error ? "unsupported" : (status.backend ?? "checking"),
    );
  }, []);
  const handleTransformCommit = useCallback(
    (
      id: Parameters<typeof editor.transformObject>[0],
      after: Parameters<typeof editor.transformObject>[1],
    ) => editor.transformObject(id, after),
    [editor],
  );
  const handleObjectTransformsCommit = useCallback(
    (updates: Parameters<typeof editor.transformObjects>[0]) =>
      editor.transformObjects(updates),
    [editor],
  );
  const handleElementTransformCommit = useCallback(
    (
      mode: TransformMode,
      updates: Parameters<typeof editor.applyElementTransform>[1],
    ) =>
      editor.applyElementTransform(
        mode === "translate"
          ? "要素を移動"
          : mode === "rotate"
            ? "要素を回転"
            : "要素を拡大縮小",
        updates,
      ),
    [editor],
  );
  const handlePick = useCallback(
    (item: Parameters<typeof editor.selectElement>[0], additive: boolean) =>
      editor.selectElement(item, additive),
    [editor],
  );
  const handleRegionPick = useCallback(
    (items: Parameters<typeof editor.selectElements>[0], additive: boolean) =>
      editor.selectElements(items, additive),
    [editor],
  );
  const handleKnifePoint = useCallback(
    (point: KnifePoint) => {
      if (!knifeStart) {
        editor.selectElement(
          { objectId: point.objectId, elementId: point.faceId },
          false,
        );
        setKnifeStart(point);
        return;
      }
      try {
        if (
          knifeStart.objectId !== point.objectId ||
          knifeStart.faceId !== point.faceId
        )
          throw new Error("同じFaceの境界上に2点を指定してください。");
        editor.knifeFaceAtPoints(
          point.objectId,
          point.faceId,
          knifeStart,
          point,
        );
        setKnifeStart(undefined);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    },
    [editor, knifeStart],
  );
  const handleModelingPreview = useCallback(
    (objects?: readonly ModelObjectSnapshot[]) => {
      setModelingPreview(objects);
      setGeometryEpoch((current) => current + 1);
    },
    [],
  );
  const handleNormalHandle = useCallback(
    (operation: NormalHandleOperation, distance: number, commit: boolean) => {
      setNormalHandleDistance(distance);
      if (!commit) {
        if (normalPreviewFrameRef.current !== undefined)
          cancelAnimationFrame(normalPreviewFrameRef.current);
        normalPreviewFrameRef.current = requestAnimationFrame(() => {
          normalPreviewFrameRef.current = undefined;
          try {
            setModelingPreview(
              operation === "extrude"
                ? editor.previewExtrudeSelectedFaces(distance)
                : editor.previewMoveSelectedAlongNormals(distance),
            );
            setGeometryEpoch((current) => current + 1);
          } catch (error) {
            setErrorMessage(
              error instanceof Error ? error.message : String(error),
            );
          }
        });
        return;
      }
      if (normalPreviewFrameRef.current !== undefined) {
        cancelAnimationFrame(normalPreviewFrameRef.current);
        normalPreviewFrameRef.current = undefined;
      }
      try {
        setModelingPreview(undefined);
        if (operation === "extrude") editor.extrudeSelectedFaces(distance);
        else editor.moveSelectedAlongNormals(distance);
        setNormalOperation(undefined);
        setNormalHandleDistance(0);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    },
    [editor],
  );
  const toggleDisplayLayer = useCallback((layer: keyof DisplayLayers) => {
    setDisplayLayers((current) => ({
      ...current,
      [layer]: !current[layer],
    }));
  }, []);

  return (
    <main className="editor-shell">
      <header className="app-header">
        <div className="brand" aria-label="Polygon Modeler">
          <Box className="brand-mark" aria-hidden="true" />
          Polygon Modeler
          {snapshot.isDirty && (
            <span className="dirty-indicator" aria-label="未保存の変更あり">
              ●
            </span>
          )}
        </div>
        <nav className="menu-bar" aria-label="メインメニュー">
          <button type="button" onClick={persistence.saveFile}>
            <FileDown aria-hidden="true" />
            保存
          </button>
          <button type="button" onClick={persistence.openFilePicker}>
            <FolderOpen aria-hidden="true" />
            開く
          </button>
          <button type="button" onClick={() => setShowImportDialog(true)}>
            <Import aria-hidden="true" />
            3D読込
          </button>
          <button type="button" onClick={() => setExportFormat("glb")}>
            <Upload aria-hidden="true" />
            3D出力
          </button>
          <button type="button" onClick={openShortcutHelp}>
            表示
            <ChevronDown aria-hidden="true" />
          </button>
          <input
            ref={persistence.fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".polyproj,application/json"
            aria-label="プロジェクトファイルを開く"
            onChange={persistence.openFile}
          />
          <input
            ref={exchange.inputRef}
            className="visually-hidden"
            type="file"
            accept=".glb,.stl,.obj,model/gltf-binary,model/stl,text/plain"
            aria-label="GLB、STLまたはOBJを読み込む"
            onChange={exchange.importFile}
          />
        </nav>
        <div className="history-actions" aria-label="履歴操作">
          <button type="button" onClick={openShortcutHelp}>
            <HelpCircle aria-hidden="true" />
            ショートカット
          </button>
          <button
            type="button"
            disabled={!snapshot.canUndo}
            onClick={() => editor.undo()}
          >
            <Undo2 aria-hidden="true" />
            元に戻す
          </button>
          <button
            type="button"
            disabled={!snapshot.canRedo}
            onClick={() => editor.redo()}
          >
            <Redo2 aria-hidden="true" />
            やり直す
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="tool-panel" aria-label="ツール">
          <h2>ツール</h2>
          {[
            { label: "選択", icon: MousePointer2, gesture: "click" as const },
            { label: "矩形選択", icon: BoxSelect, gesture: "box" as const },
            {
              label: "投げ縄選択",
              icon: LassoSelect,
              gesture: "lasso" as const,
            },
          ].map(({ label, icon: Icon, gesture }) => (
            <button
              type="button"
              className={`tool-button${selectionGesture === gesture ? " active" : ""}`}
              onClick={() => setSelectionGesture(gesture)}
              key={label}
            >
              <Icon aria-hidden="true" />
              {label}
            </button>
          ))}
          <div className="tool-divider" />
          <button
            type="button"
            className="tool-button"
            onClick={() => editor.createBox()}
          >
            <Plus aria-hidden="true" />
            Box追加
          </button>
          <button
            type="button"
            className="tool-button"
            onClick={() => editor.createPlane()}
          >
            <Plus aria-hidden="true" />
            Plane追加
          </button>
          <button
            type="button"
            className="tool-button"
            onClick={() => editor.createCylinder()}
          >
            <Plus aria-hidden="true" />
            Cylinder追加
          </button>
          <button
            type="button"
            className="tool-button"
            disabled={snapshot.selectedObjectIds.size === 0}
            onClick={() => editor.deleteSelectedElements()}
          >
            <Trash2 aria-hidden="true" />
            削除
          </button>
        </aside>

        <section
          className="viewport-panel"
          aria-label="3D ビューポート"
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenu({ x: event.clientX, y: event.clientY });
          }}
        >
          <ViewportControls
            selectionModes={snapshot.selectionModes}
            onToggleSelectionMode={(mode) => editor.toggleSelectionMode(mode)}
            displayLayers={displayLayers}
            onToggleDisplayLayer={toggleDisplayLayer}
            projection={projection}
            onProjectionChange={setProjection}
            axisConstraint={axisConstraint}
            transformOrientation={transformOrientation}
            onTransformOrientationChange={setTransformOrientation}
            onAxisConstraintChange={setAxisConstraint}
            snapSettings={snapSettings}
            onSnapSettingsChange={setSnapSettings}
          />
          {modelingPreview && (
            <div className="modeling-preview-badge" role="status">
              モデリングプレビュー
            </div>
          )}
          <ViewportCanvas
            projection={projection}
            onStatusChange={handleViewportStatus}
            objects={modelingPreview ?? snapshot.objects}
            selectedObjectIds={
              modelingPreview && !normalOperation
                ? new Set()
                : snapshot.selectedObjectIds
            }
            transformMode={transformMode}
            onTransformCommit={handleTransformCommit}
            onObjectTransformsCommit={handleObjectTransformsCommit}
            onElementTransformCommit={handleElementTransformCommit}
            selectionModes={snapshot.selectionModes}
            selectionItems={
              modelingPreview && !normalOperation ? [] : snapshot.selectionItems
            }
            displayLayers={displayLayers}
            onPick={handlePick}
            selectionGesture={selectionGesture}
            onPickRegion={handleRegionPick}
            axisConstraint={axisConstraint}
            transformOrientation={transformOrientation}
            snapSettings={snapSettings}
            modelingPreviewActive={Boolean(modelingPreview)}
            geometryEpoch={geometryEpoch}
            normalOperation={normalOperation}
            onNormalHandle={handleNormalHandle}
            lightingSettings={lightingSettings}
            knifeActive={knifeActive}
            onKnifePoint={handleKnifePoint}
            knifeStart={knifeStart}
          />
          {normalOperation && (
            <div className="normal-operation-badge" role="status">
              {normalOperation === "extrude" ? "押し出し" : "法線移動"}:{" "}
              {normalHandleDistance.toFixed(3)}
              <button
                type="button"
                onClick={() => {
                  setNormalOperation(undefined);
                  setModelingPreview(undefined);
                  setNormalHandleDistance(0);
                }}
              >
                キャンセル
              </button>
            </div>
          )}
          {knifeActive && (
            <div className="normal-operation-badge" role="status">
              Knife: {knifeStart ? "終点をクリック" : "始点をクリック"}
              <button
                type="button"
                onClick={() => {
                  setKnifeActive(false);
                  setKnifeStart(undefined);
                }}
              >
                終了
              </button>
            </div>
          )}
          {contextMenu && (
            <div
              ref={contextMenuRef}
              className="context-menu"
              role="menu"
              tabIndex={-1}
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  setContextMenu(undefined);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setContextMenu(undefined);
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  editor.selectAll();
                  setContextMenu(undefined);
                }}
              >
                すべて選択
                <kbd>⌘/Ctrl A</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  editor.clearSelection();
                  setContextMenu(undefined);
                }}
              >
                選択解除
                <kbd>Alt A</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={
                  snapshot.selectionItems.length === 0 &&
                  snapshot.selectedObjectIds.size === 0
                }
                onClick={() => {
                  try {
                    editor.deleteSelectedElements();
                  } catch (error) {
                    setErrorMessage(
                      error instanceof Error ? error.message : String(error),
                    );
                  }
                  setContextMenu(undefined);
                }}
              >
                削除
                <kbd>Delete</kbd>
              </button>
            </div>
          )}
        </section>

        <ScenePanel
          editor={editor}
          snapshot={snapshot}
          onError={setErrorMessage}
          onModelingPreview={handleModelingPreview}
          transformMode={transformMode}
          transformOrientation={transformOrientation}
          onTransformModeChange={(mode) =>
            setTransformMode((current) => (current === mode ? undefined : mode))
          }
          normalOperation={normalOperation}
          lightingSettings={lightingSettings}
          onLightingSettingsChange={setLightingSettings}
          knifeActive={knifeActive}
          onKnifeActiveChange={(active) => {
            setKnifeActive(active);
            setKnifeStart(undefined);
          }}
          onNormalOperationChange={(operation) => {
            setNormalHandleDistance(0);
            setModelingPreview(undefined);
            setNormalOperation((current) =>
              current === operation ? undefined : operation,
            );
          }}
        />
      </div>

      <footer className="status-bar">
        <span>変形: {transformMode ?? "OFF"}</span>
        <span>
          モード: {[...snapshot.selectionModes].join("+") || "選択OFF"}
        </span>
        <span>選択: {snapshot.selectionItems.length}</span>
        <span>
          軸: {axisConstraint === "all" ? "XYZ" : axisConstraint.toUpperCase()}
        </span>
        <span>
          スナップ: {snapSettings.grid ? "Grid " : ""}
          {snapSettings.vertex ? "Vertex" : ""}
          {snapSettings.edge ? " Edge" : ""}
          {snapSettings.face ? " Face" : ""}
          {!snapSettings.grid &&
          !snapSettings.vertex &&
          !snapSettings.edge &&
          !snapSettings.face
            ? "OFF"
            : ""}
        </span>
        <span>
          頂点:{" "}
          {snapshot.objects.reduce(
            (sum, object) => sum + object.mesh.positions.length / 3,
            0,
          )}
        </span>
        <span>
          面:{" "}
          {snapshot.objects.reduce(
            (sum, object) => sum + object.mesh.faces.length,
            0,
          )}
        </span>
        <span
          className={`renderer-status renderer-status-${capability}`}
          data-testid="renderer-capability"
        >
          <CircleGauge aria-hidden="true" />
          {labels[capability]}
        </span>
      </footer>
      {showShortcuts && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="shortcut-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcut-title"
          >
            <header>
              <h2 id="shortcut-title">キーボードショートカット</h2>
              <button type="button" onClick={() => setShowShortcuts(false)}>
                閉じる
              </button>
            </header>
            <dl>
              {[
                ["1 / 2 / 3", "Vertex / Edge / Face"],
                ["G / R / S", "移動 / 回転 / 拡大縮小"],
                ["X / Y / Z", "操作軸を制限"],
                ["⌘/Ctrl A", "すべて選択"],
                ["Alt A", "選択解除"],
                ["Delete", "削除"],
                ["⌘/Ctrl Z", "元に戻す"],
                ["⌘/Ctrl Shift Z", "やり直す"],
                ["?", "この一覧を表示"],
              ].map(([key, description]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
      {showImportDialog && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="shortcut-dialog exchange-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-dialog-title"
          >
            <header>
              <h2 id="import-dialog-title">3Dファイルを読み込む</h2>
              <button
                type="button"
                onClick={() => setShowImportDialog(false)}
                disabled={exchange.importProgress !== undefined}
              >
                閉じる
              </button>
            </header>
            <p>GLB、STL、OBJに設定されている座標系を指定します。</p>
            <div className="exchange-options">
              <label>
                <span>入力単位</span>
                <select
                  aria-label="読み込み単位"
                  value={importSettings.unit}
                  onChange={(event) => {
                    const unit = event.currentTarget.value as
                      | "meter"
                      | "millimeter";
                    setImportSettings((current) => ({ ...current, unit }));
                  }}
                >
                  <option value="meter">メートル (m)</option>
                  <option value="millimeter">ミリメートル (mm)</option>
                </select>
              </label>
              <label>
                <span>入力ファイルのUp軸</span>
                <select
                  aria-label="読み込みUp軸"
                  value={importSettings.upAxis}
                  onChange={(event) => {
                    const upAxis = event.currentTarget.value as "y" | "z";
                    setImportSettings((current) => ({ ...current, upAxis }));
                  }}
                >
                  <option value="y">Y Up</option>
                  <option value="z">Z Up</option>
                </select>
              </label>
            </div>
            {exchange.importProgress !== undefined && (
              <div className="import-progress" role="status">
                読み込み中 {Math.round(exchange.importProgress * 100)}%
                <button type="button" onClick={exchange.cancelImport}>
                  中止
                </button>
              </div>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => setShowImportDialog(false)}
                disabled={exchange.importProgress !== undefined}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={exchange.openPicker}
                disabled={exchange.importProgress !== undefined}
              >
                ファイルを選択
              </button>
            </div>
          </section>
        </div>
      )}
      {exportFormat && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="shortcut-dialog exchange-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
          >
            <header>
              <h2 id="export-dialog-title">3Dファイルを書き出す</h2>
              <button type="button" onClick={() => setExportFormat(undefined)}>
                閉じる
              </button>
            </header>
            <div className="exchange-options">
              <label>
                <span>出力形式</span>
                <select
                  aria-label="出力形式"
                  value={exportFormat}
                  onChange={(event) =>
                    setExportFormat(
                      event.currentTarget.value as "glb" | "stl" | "obj",
                    )
                  }
                >
                  <option value="glb">GLB</option>
                  <option value="stl">STL</option>
                  <option value="obj">OBJ</option>
                </select>
              </label>
              <label className="exchange-checkbox">
                <input
                  type="checkbox"
                  checked={includeHidden}
                  onChange={(event) =>
                    setIncludeHidden(event.currentTarget.checked)
                  }
                />
                非表示のObjectも出力する
              </label>
            </div>
            <p className="dialog-hint">
              GLBはマテリアルとUVを保持します。STLは形状のみ、OBJは形状とUVを出力します。
            </p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setExportFormat(undefined)}>
                キャンセル
              </button>
              <button
                type="button"
                onClick={
                  exportFormat === "glb"
                    ? exchange.exportGlb
                    : exportFormat === "stl"
                      ? exchange.exportStl
                      : exchange.exportObj
                }
              >
                書き出す
              </button>
            </div>
          </section>
        </div>
      )}
      {persistence.recoverySource && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="shortcut-dialog recovery-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-title"
          >
            <header>
              <h2 id="recovery-title">自動保存を復元</h2>
              <RotateCcw aria-hidden="true" />
            </header>
            <p>前回の編集内容が見つかりました。復元しますか？</p>
            <div className="dialog-actions">
              <button type="button" onClick={persistence.discardAutosave}>
                破棄
              </button>
              <button type="button" onClick={persistence.restoreAutosave}>
                復元
              </button>
            </div>
          </section>
        </div>
      )}
      {errorMessage && (
        <div className="error-toast" role="alert">
          <AlertCircle aria-hidden="true" />
          {errorMessage}
          <button type="button" onClick={() => setErrorMessage(undefined)}>
            閉じる
          </button>
        </div>
      )}
      {successMessage && (
        <div className="success-toast" role="status">
          <CheckCircle2 aria-hidden="true" />
          {successMessage}
          <button type="button" onClick={() => setSuccessMessage(undefined)}>
            閉じる
          </button>
        </div>
      )}
    </main>
  );
}
