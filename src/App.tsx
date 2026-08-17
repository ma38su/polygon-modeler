import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelObjectSnapshot } from "./editor/document/types";
import {
  AlertCircle,
  Box,
  BoxSelect,
  ChevronDown,
  CircleGauge,
  Expand,
  FileDown,
  FolderOpen,
  HelpCircle,
  Import,
  LassoSelect,
  MousePointer2,
  Move3D,
  Plus,
  Redo2,
  Rotate3D,
  RotateCcw,
  Trash2,
  Upload,
  Undo2,
} from "lucide-react";
import { ViewportCanvas } from "./viewport/ViewportCanvas";
import type { SelectionGesture } from "./viewport/ViewportCanvas";
import type { ViewportStatus } from "./viewport/Viewport";
import type {
  AxisConstraint,
  SnapSettings,
  TransformMode,
} from "./viewport/Viewport";
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
  const [transformMode, setTransformMode] =
    useState<TransformMode>("translate");
  const [selectionGesture, setSelectionGesture] =
    useState<SelectionGesture>("click");
  const [axisConstraint, setAxisConstraint] = useState<AxisConstraint>("all");
  const [snapSettings, setSnapSettings] = useState<SnapSettings>({
    grid: false,
    vertex: false,
    gridSize: 0.5,
  });
  const [displayLayers, setDisplayLayers] = useState<DisplayLayers>({
    ...DEFAULT_DISPLAY_LAYERS,
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [modelingPreview, setModelingPreview] =
    useState<readonly ModelObjectSnapshot[]>();
  const [geometryEpoch, setGeometryEpoch] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number }>();
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const openShortcutHelp = useCallback(() => setShowShortcuts(true), []);
  const activateTransformMode = useCallback((mode: TransformMode) => {
    setSelectionGesture("click");
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
  const handleViewportStatus = useCallback((status: ViewportStatus) => {
    setCapability(
      status.error ? "unsupported" : (status.backend ?? "checking"),
    );
  }, []);
  const handleTransformCommit = useCallback(
    (...args: Parameters<typeof editor.transformObject>) =>
      editor.transformObject(...args),
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
  const handleModelingPreview = useCallback(
    (objects?: readonly ModelObjectSnapshot[]) => {
      setModelingPreview(objects);
      setGeometryEpoch((current) => current + 1);
    },
    [],
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
          <button type="button" onClick={exchange.openPicker}>
            <Import aria-hidden="true" />
            3D読込
          </button>
          <button type="button" onClick={exchange.exportGlb}>
            <Upload aria-hidden="true" />
            GLB出力
          </button>
          <button type="button" onClick={exchange.exportStl}>
            <Upload aria-hidden="true" />
            STL出力
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
            accept=".glb,.stl,model/gltf-binary,model/stl"
            aria-label="GLBまたはSTLを読み込む"
            onChange={exchange.importFile}
          />
        </nav>
        <div className="history-actions" aria-label="履歴操作">
          <label className="include-hidden">
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={(event) =>
                setIncludeHidden(event.currentTarget.checked)
              }
            />
            非表示も出力
          </label>
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
          {[
            { label: "移動", icon: Move3D, mode: "translate" as const },
            { label: "回転", icon: Rotate3D, mode: "rotate" as const },
            { label: "拡大縮小", icon: Expand, mode: "scale" as const },
          ].map(({ label, icon: Icon, mode }) => (
            <button
              type="button"
              className={`tool-button${selectionGesture === "click" && transformMode === mode ? " active" : ""}`}
              onClick={() => activateTransformMode(mode)}
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
              modelingPreview ? new Set() : snapshot.selectedObjectIds
            }
            transformMode={transformMode}
            onTransformCommit={handleTransformCommit}
            onElementTransformCommit={handleElementTransformCommit}
            selectionModes={snapshot.selectionModes}
            selectionItems={modelingPreview ? [] : snapshot.selectionItems}
            displayLayers={displayLayers}
            onPick={handlePick}
            selectionGesture={selectionGesture}
            onPickRegion={handleRegionPick}
            axisConstraint={axisConstraint}
            snapSettings={snapSettings}
            modelingPreviewActive={Boolean(modelingPreview)}
            geometryEpoch={geometryEpoch}
          />
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
        />
      </div>

      <footer className="status-bar">
        <span>ツール: {transformMode}</span>
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
          {!snapSettings.grid && !snapSettings.vertex ? "OFF" : ""}
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
    </main>
  );
}
