import { Box, Combine, Copy, Eye, EyeOff, FlipHorizontal2 } from "lucide-react";
import type { Editor } from "../../editor/Editor";
import type { EditorSnapshot } from "../../editor/document/types";
import { ElementTransformPanel } from "../inspector/ElementTransformPanel";
import { TransformInspector } from "../inspector/TransformInspector";

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
  const selectedObject = snapshot.objects.find((object) =>
    snapshot.selectedObjectIds.has(object.id),
  );

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
          <TransformInspector editor={editor} object={selectedObject} />
        ) : (
          <div className="empty-state">オブジェクトを選択してください</div>
        )}
      </section>
    </aside>
  );
}
