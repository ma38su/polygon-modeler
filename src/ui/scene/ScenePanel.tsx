import { useState } from "react";
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
} from "lucide-react";
import type { BooleanOperation } from "../../editor/boolean/booleanOperations";
import type { Editor } from "../../editor/Editor";
import type { EditorSnapshot } from "../../editor/document/types";
import { ElementTransformPanel } from "../inspector/ElementTransformPanel";
import { TransformInspector } from "../inspector/TransformInspector";
import { diagnoseMesh } from "../../editor/mesh/meshDiagnostics";

interface ScenePanelProps {
  editor: Editor;
  snapshot: EditorSnapshot;
  onError(message: string): void;
  onModelingPreview(objects?: EditorSnapshot["objects"]): void;
}

export function ScenePanel({
  editor,
  snapshot,
  onError,
  onModelingPreview,
}: ScenePanelProps) {
  const [booleanPending, setBooleanPending] = useState(false);
  const [mergeDistance, setMergeDistance] = useState(0.0001);
  const selectedObject = snapshot.objects.find((object) =>
    snapshot.selectedObjectIds.has(object.id),
  );
  const diagnostics = selectedObject
    ? diagnoseMesh(selectedObject.mesh)
    : undefined;
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
        <div className="object-actions">
          <button
            type="button"
            disabled={snapshot.selectedObjectIds.size === 0}
            onClick={() => editor.duplicateSelectedObjects()}
          >
            <Copy aria-hidden="true" />
            複製
          </button>
          <button
            type="button"
            disabled={snapshot.selectedObjectIds.size < 2}
            onClick={() => editor.joinSelectedObjects()}
          >
            <Combine aria-hidden="true" />
            結合
          </button>
          {(["x", "y", "z"] as const).map((axis) => (
            <button
              type="button"
              key={axis}
              disabled={snapshot.selectedObjectIds.size === 0}
              onClick={() => editor.mirrorSelectedObjects(axis)}
            >
              <FlipHorizontal2 aria-hidden="true" />
              Mirror {axis.toUpperCase()}
            </button>
          ))}
          {(
            [
              ["union", "Union", GitMerge],
              ["subtract", "Subtract", Minus],
              ["intersect", "Intersect", Blend],
            ] as const
          ).map(([operation, label, Icon]) => (
            <button
              type="button"
              key={operation}
              disabled={booleanPending || snapshot.selectedObjectIds.size !== 2}
              onClick={() => void runBoolean(operation)}
            >
              <Icon aria-hidden="true" />
              {booleanPending ? "演算中…" : label}
            </button>
          ))}
        </div>
      </section>
      <section aria-labelledby="inspector-title">
        <h2 id="inspector-title">インスペクター</h2>
        {snapshot.selectionItems.length ? (
          <ElementTransformPanel
            editor={editor}
            onError={onError}
            onPreview={onModelingPreview}
          />
        ) : selectedObject ? (
          <>
            <TransformInspector editor={editor} object={selectedObject} />
            <div className="mesh-diagnostics" aria-label="メッシュ診断">
              <h3>メッシュ診断</h3>
              <dl>
                <div>
                  <dt>状態</dt>
                  <dd>{diagnostics!.healthy ? "正常" : "要修復"}</dd>
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
              <div className="mesh-repair-actions">
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
                <button
                  type="button"
                  onClick={() =>
                    runAction(() =>
                      editor.mergeSelectedObjectsByDistance(mergeDistance),
                    )
                  }
                >
                  <Combine aria-hidden="true" />
                  Merge by Distance
                </button>
                <button
                  type="button"
                  onClick={() =>
                    runAction(() => editor.recalculateSelectedObjectNormals())
                  }
                >
                  <RefreshCw aria-hidden="true" />
                  法線再計算
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">オブジェクトを選択してください</div>
        )}
      </section>
    </aside>
  );
}
