import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Box,
  BoxIcon,
  ChevronDown,
  CircleGauge,
  Expand,
  Eye,
  EyeOff,
  FileDown,
  FolderOpen,
  HelpCircle,
  MousePointer2,
  Move3D,
  Plus,
  Redo2,
  Rotate3D,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import { ViewportCanvas } from "./viewport/ViewportCanvas";
import type { ViewportStatus } from "./viewport/Viewport";
import type { TransformMode } from "./viewport/Viewport";
import { useEditor, useEditorSnapshot } from "./app/useEditor";
import { useEditorShortcuts } from "./app/shortcuts/useEditorShortcuts";
import { TransformInspector } from "./ui/inspector/TransformInspector";
import { ElementTransformPanel } from "./ui/inspector/ElementTransformPanel";
import { useProjectPersistence } from "./app/useProjectPersistence";
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
  const selectedObject = snapshot.objects.find((object) =>
    snapshot.selectedObjectIds.has(object.id),
  );
  const [capability, setCapability] = useState<Capability>("checking");
  const [projection, setProjection] = useState<"perspective" | "orthographic">(
    "perspective",
  );
  const [transformMode, setTransformMode] =
    useState<TransformMode>("translate");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number }>();
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const openShortcutHelp = useCallback(() => setShowShortcuts(true), []);
  const persistence = useProjectPersistence(
    editor,
    snapshot.revision,
    snapshot.isDirty,
    setErrorMessage,
  );
  useEditorShortcuts(editor, {
    setTransformMode,
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
  const handlePick = useCallback(
    (item: Parameters<typeof editor.selectElement>[0], additive: boolean) =>
      editor.selectElement(item, additive),
    [editor],
  );

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
            { label: "選択", icon: MousePointer2, mode: "translate" as const },
            { label: "移動", icon: Move3D, mode: "translate" as const },
            { label: "回転", icon: Rotate3D, mode: "rotate" as const },
            { label: "拡大縮小", icon: Expand, mode: "scale" as const },
          ].map(({ label, icon: Icon, mode }, index) => (
            <button
              type="button"
              className={`tool-button${index > 0 && transformMode === mode ? " active" : ""}`}
              onClick={() => setTransformMode(mode)}
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
          <div className="selection-mode-bar" aria-label="選択モード">
            {(
              [
                ["object", "Object"],
                ["vertex", "Vertex"],
                ["edge", "Edge"],
                ["face", "Face"],
              ] as const
            ).map(([mode, label]) => (
              <button
                type="button"
                key={mode}
                className={snapshot.selectionMode === mode ? "active" : ""}
                onClick={() => editor.setSelectionMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="viewport-toolbar" aria-label="ビューポート設定">
            <button
              type="button"
              className={projection === "perspective" ? "active" : ""}
              onClick={() => setProjection("perspective")}
            >
              <BoxIcon aria-hidden="true" />
              透視
            </button>
            <button
              type="button"
              className={projection === "orthographic" ? "active" : ""}
              onClick={() => setProjection("orthographic")}
            >
              <Box aria-hidden="true" />
              正投影
            </button>
          </div>
          <ViewportCanvas
            projection={projection}
            onStatusChange={handleViewportStatus}
            objects={snapshot.objects}
            selectedObjectIds={snapshot.selectedObjectIds}
            transformMode={transformMode}
            onTransformCommit={handleTransformCommit}
            selectionMode={snapshot.selectionMode}
            onPick={handlePick}
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
                      snapshot.selectedObjectIds.has(object.id)
                        ? "selected"
                        : ""
                    }
                    key={object.id}
                  >
                    <button
                      type="button"
                      className="object-select"
                      onClick={() => editor.selectObject(object.id)}
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
          </section>
          <section aria-labelledby="inspector-title">
            <h2 id="inspector-title">インスペクター</h2>
            {snapshot.selectionMode !== "object" &&
            snapshot.selectionItems.length ? (
              <ElementTransformPanel
                editor={editor}
                onError={setErrorMessage}
              />
            ) : selectedObject ? (
              <TransformInspector editor={editor} object={selectedObject} />
            ) : (
              <div className="empty-state">オブジェクトを選択してください</div>
            )}
          </section>
        </aside>
      </div>

      <footer className="status-bar">
        <span>ツール: {transformMode}</span>
        <span>モード: {snapshot.selectionMode}</span>
        <span>選択: {snapshot.selectionItems.length}</span>
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
                ["1 / 2 / 3 / 4", "Object / Vertex / Edge / Face"],
                ["G / R / S", "移動 / 回転 / 拡大縮小"],
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
