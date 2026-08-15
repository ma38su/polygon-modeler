import { useCallback, useState } from "react";
import {
  Box,
  BoxIcon,
  ChevronDown,
  CircleGauge,
  Expand,
  MousePointer2,
  Move3D,
  Redo2,
  Rotate3D,
  Undo2,
} from "lucide-react";
import { ViewportCanvas } from "./viewport/ViewportCanvas";
import type { ViewportStatus } from "./viewport/Viewport";
import "./App.css";

type Capability = "checking" | "webgpu" | "webgl2" | "unsupported";
const labels: Record<Capability, string> = {
  checking: "描画環境を確認中",
  webgpu: "WebGPU 対応",
  webgl2: "WebGL 2 フォールバック",
  unsupported: "3D 描画非対応",
};

export default function App() {
  const [capability, setCapability] = useState<Capability>("checking");
  const [projection, setProjection] = useState<"perspective" | "orthographic">(
    "perspective",
  );
  const handleViewportStatus = useCallback((status: ViewportStatus) => {
    setCapability(
      status.error ? "unsupported" : (status.backend ?? "checking"),
    );
  }, []);

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
          <button type="button" disabled>
            <Undo2 aria-hidden="true" />
            元に戻す
          </button>
          <button type="button" disabled>
            <Redo2 aria-hidden="true" />
            やり直す
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="tool-panel" aria-label="ツール">
          <h2>ツール</h2>
          {[
            { label: "選択", icon: MousePointer2 },
            { label: "移動", icon: Move3D },
            { label: "回転", icon: Rotate3D },
            { label: "拡大縮小", icon: Expand },
          ].map(({ label, icon: Icon }, index) => (
            <button
              type="button"
              className={`tool-button${index === 0 ? " active" : ""}`}
              disabled={index !== 0}
              key={label}
            >
              <Icon aria-hidden="true" />
              {label}
            </button>
          ))}
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
          />
        </section>

        <aside className="side-panel">
          <section aria-labelledby="outliner-title">
            <h2 id="outliner-title">オブジェクト</h2>
            <div className="empty-state">
              <Box aria-hidden="true" />
              シーンは空です
            </div>
          </section>
          <section aria-labelledby="inspector-title">
            <h2 id="inspector-title">インスペクター</h2>
            <div className="empty-state">オブジェクトを選択してください</div>
          </section>
        </aside>
      </div>

      <footer className="status-bar">
        <span>選択: 0</span>
        <span>頂点: 0</span>
        <span>面: 0</span>
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
