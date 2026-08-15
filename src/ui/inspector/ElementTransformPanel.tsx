import { useState } from "react";
import type { Editor } from "../../editor/Editor";
import {
  Ban,
  Combine,
  FlipVertical2,
  Layers3,
  Scissors,
  SquareDashed,
} from "lucide-react";
type Values = { x: number; y: number; z: number };
export function ElementTransformPanel({ editor }: { editor: Editor }) {
  const [move, setMove] = useState<Values>({ x: 0, y: 0, z: 0 });
  const [rotate, setRotate] = useState<Values>({ x: 0, y: 0, z: 0 });
  const [scale, setScale] = useState<Values>({ x: 1, y: 1, z: 1 });
  const [extrudeDistance, setExtrudeDistance] = useState(1);
  const resetModelingPreview = () => setExtrudeDistance(1);
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
        <label className="scalar-field">
          <span>押し出し量</span>
          <input
            aria-label="押し出し量"
            type="number"
            step="0.1"
            value={extrudeDistance}
            onChange={(event) =>
              setExtrudeDistance(Number(event.currentTarget.value))
            }
          />
        </label>
        <button
          type="button"
          onClick={() => {
            editor.extrudeSelectedFaces(extrudeDistance);
            resetModelingPreview();
          }}
        >
          <Layers3 aria-hidden="true" />
          押し出し
        </button>
        <button type="button" onClick={() => editor.splitSelectedElements()}>
          <Scissors aria-hidden="true" />
          分割
        </button>
        <button type="button" onClick={() => editor.createFaceFromSelection()}>
          <SquareDashed aria-hidden="true" />
          面生成
        </button>
        <button type="button" onClick={() => editor.mergeSelectedVertices()}>
          <Combine aria-hidden="true" />
          頂点結合
        </button>
        <button type="button" onClick={() => editor.flipSelectedFaces()}>
          <FlipVertical2 aria-hidden="true" />
          面反転
        </button>
        <button type="button" onClick={resetModelingPreview}>
          <Ban aria-hidden="true" />
          キャンセル
        </button>
      </fieldset>
    </div>
  );
}
