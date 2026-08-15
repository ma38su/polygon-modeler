import { useCallback, useState } from "react";
import {
  Box,
  BoxIcon,
  ChevronDown,
  CircleGauge,
  Expand,
  Eye,
  EyeOff,
  MousePointer2,
  Move3D,
  Plus,
  Redo2,
  Rotate3D,
  Trash2,
  Undo2,
} from "lucide-react";
import { ViewportCanvas } from "./viewport/ViewportCanvas";
import type { ViewportStatus } from "./viewport/Viewport";
import type { TransformMode } from "./viewport/Viewport";
import { useEditor, useEditorSnapshot } from "./app/useEditor";
import { useEditorShortcuts } from "./app/shortcuts/useEditorShortcuts";
import { TransformInspector } from "./ui/inspector/TransformInspector";
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
  useEditorShortcuts(editor);
  const selectedObject = snapshot.objects.find((object) =>
    snapshot.selectedObjectIds.has(object.id),
  );
  const [capability, setCapability] = useState<Capability>("checking");
  const [projection, setProjection] = useState<"perspective" | "orthographic">(
    "perspective",
  );
  const [transformMode, setTransformMode] =
    useState<TransformMode>("translate");
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

  return (
    <main className="editor-shell">
      <header className="app-header">
        <div className="brand" aria-label="Polygon Modeler">
          <Box className="brand-mark" aria-hidden="true" />
          Polygon Modeler
        </div>
        <nav className="menu-bar" aria-label="メインメニュー">
          {["ファイル", "編集", "表示"].map((menu) => (
            <button type="button" key={menu}>
              {menu}
              <ChevronDown aria-hidden="true" />
            </button>
          ))}
        </nav>
        <div className="history-actions" aria-label="履歴操作">
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
            onClick={() => editor.deleteSelectedObjects()}
          >
            <Trash2 aria-hidden="true" />
            削除
          </button>
        </aside>

        <section className="viewport-panel" aria-label="3D ビューポート">
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
          />
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
            {selectedObject ? (
              <TransformInspector editor={editor} object={selectedObject} />
            ) : (
              <div className="empty-state">オブジェクトを選択してください</div>
            )}
          </section>
        </aside>
      </div>

      <footer className="status-bar">
        <span>選択: {snapshot.selectedObjectIds.size}</span>
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
    </main>
  );
}
