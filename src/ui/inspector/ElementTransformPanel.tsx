import { useEffect, useState } from "react";
import type { Editor } from "../../editor/Editor";
import type { ModelObjectSnapshot } from "../../editor/document/types";
import {
  Combine,
  FlipVertical2,
  Layers3,
  Scissors,
  SquareDashed,
} from "lucide-react";
type Values = { x: number; y: number; z: number };
export function ElementTransformPanel({
  editor,
  onError,
  onPreview,
}: {
  editor: Editor;
  onError(message: string): void;
  onPreview(objects?: readonly ModelObjectSnapshot[]): void;
}) {
  const [move, setMove] = useState<Values>({ x: 0, y: 0, z: 0 });
  const [rotate, setRotate] = useState<Values>({ x: 0, y: 0, z: 0 });
  const [scale, setScale] = useState<Values>({ x: 1, y: 1, z: 1 });
  const [extrudeDistance, setExtrudeDistance] = useState(1);
  const [showExtrudeDialog, setShowExtrudeDialog] = useState(false);
  const run = (action: () => void) => {
    try {
      action();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  const closeExtrudeDialog = () => {
    onPreview(undefined);
    setShowExtrudeDialog(false);
    setExtrudeDistance(1);
  };
  const previewExtrusion = (distance: number) => {
    try {
      onPreview(editor.previewExtrudeSelectedFaces(distance));
    } catch (error) {
      onPreview(undefined);
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  useEffect(() => () => onPreview(undefined), [onPreview]);
  const applyExtrusion = () => {
    try {
      editor.extrudeSelectedFaces(extrudeDistance);
      closeExtrudeDialog();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  const fields = (values: Values, setValues: (value: Values) => void) => (
    <div className="vector-fields">
      {(["x", "y", "z"] as const).map((axis) => (
        <label key={axis}>
          <span>{axis.toUpperCase()}</span>
          <input
            aria-label={`${axis}軸`}
            type="number"
            step="0.1"
            value={values[axis]}
            onChange={(event) =>
              setValues({
                ...values,
                [axis]: Number(event.currentTarget.value),
              })
            }
          />
        </label>
      ))}
    </div>
  );
  return (
    <div className="element-transform">
      <fieldset>
        <legend>相対移動</legend>
        {fields(move, setMove)}
        <button type="button" onClick={() => editor.translateSelected(move)}>
          適用
        </button>
      </fieldset>
      <fieldset>
        <legend>回転（度）</legend>
        {fields(rotate, setRotate)}
        <button
          type="button"
          onClick={() =>
            editor.rotateSelected({
              x: (rotate.x * Math.PI) / 180,
              y: (rotate.y * Math.PI) / 180,
              z: (rotate.z * Math.PI) / 180,
            })
          }
        >
          適用
        </button>
      </fieldset>
      <fieldset>
        <legend>スケール</legend>
        {fields(scale, setScale)}
        <button type="button" onClick={() => editor.scaleSelected(scale)}>
          適用
        </button>
      </fieldset>
      <fieldset className="modeling-actions">
        <legend>モデリング</legend>
        <button
          type="button"
          onClick={() => {
            setShowExtrudeDialog(true);
            previewExtrusion(extrudeDistance);
          }}
        >
          <Layers3 aria-hidden="true" />
          押し出し
        </button>
        <button
          type="button"
          onClick={() => run(() => editor.splitSelectedElements())}
        >
          <Scissors aria-hidden="true" />
          分割
        </button>
        <button
          type="button"
          onClick={() => run(() => editor.createFaceFromSelection())}
        >
          <SquareDashed aria-hidden="true" />
          面生成
        </button>
        <button
          type="button"
          onClick={() => run(() => editor.mergeSelectedVertices())}
        >
          <Combine aria-hidden="true" />
          頂点結合
        </button>
        <button
          type="button"
          onClick={() => run(() => editor.flipSelectedFaces())}
        >
          <FlipVertical2 aria-hidden="true" />
          面反転
        </button>
      </fieldset>
      {showExtrudeDialog && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="shortcut-dialog extrusion-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="extrusion-dialog-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") closeExtrudeDialog();
            }}
          >
            <header>
              <h2 id="extrusion-dialog-title">面を押し出す</h2>
            </header>
            <p>選択中の面を法線方向へ押し出します。</p>
            <label className="scalar-field extrusion-distance-field">
              <span>押し出し量</span>
              <input
                autoFocus
                aria-label="押し出し量"
                type="number"
                step="0.1"
                value={extrudeDistance}
                onChange={(event) => {
                  const distance = Number(event.currentTarget.value);
                  setExtrudeDistance(distance);
                  if (Number.isFinite(distance)) previewExtrusion(distance);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyExtrusion();
                }}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={closeExtrudeDialog}>
                キャンセル
              </button>
              <button type="button" onClick={applyExtrusion}>
                押し出す
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
