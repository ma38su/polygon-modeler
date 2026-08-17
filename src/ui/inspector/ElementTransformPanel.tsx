import { useEffect, useState } from "react";
import type { Editor } from "../../editor/Editor";
import type { ModelObjectSnapshot } from "../../editor/document/types";
import {
  Combine,
  BetweenHorizontalEnd,
  ArrowUpFromLine,
  Component,
  FlipVertical2,
  Layers3,
  Maximize2,
  Minimize2,
  Shrink,
  Scissors,
  Slice,
  SquareDashed,
  Waypoints,
  Ungroup,
} from "lucide-react";
type Values = { x: number; y: number; z: number };
type ModelingOperation = "extrude" | "inset" | "bevel" | "normalMove";
type ModelingOperationConfig = {
  title: string;
  description: string;
  label: string;
  confirm: string;
  defaultValue: number;
  step: number;
  min?: number;
  max?: number;
};

const modelingOperations: Record<ModelingOperation, ModelingOperationConfig> = {
  extrude: {
    title: "面を押し出す",
    description: "選択中の面を法線方向へ押し出します。",
    label: "押し出し量",
    confirm: "押し出す",
    defaultValue: 1,
    step: 0.1,
  },
  inset: {
    title: "面をインセット",
    description: "選択中の面の内側に、新しい輪郭を作成します。",
    label: "インセット率",
    confirm: "インセット",
    defaultValue: 0.2,
    step: 0.05,
    min: 0,
    max: 0.95,
  },
  bevel: {
    title: "要素をベベル",
    description: "選択中の頂点、または辺の両端の角を落とします。",
    label: "ベベル率",
    confirm: "ベベル",
    defaultValue: 0.15,
    step: 0.05,
    min: 0.01,
    max: 0.49,
  },
  normalMove: {
    title: "法線方向へ移動",
    description: "選択中の面、または辺を平均法線方向へ移動します。",
    label: "移動量",
    confirm: "移動",
    defaultValue: 0.25,
    step: 0.05,
  },
};
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
  const [modelingOperation, setModelingOperation] =
    useState<ModelingOperation>();
  const [modelingValue, setModelingValue] = useState(1);
  const run = (action: () => void) => {
    try {
      action();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  const closeModelingDialog = () => {
    onPreview(undefined);
    setModelingOperation(undefined);
  };
  const previewModeling = (operation: ModelingOperation, value: number) => {
    try {
      onPreview(
        operation === "extrude"
          ? editor.previewExtrudeSelectedFaces(value)
          : operation === "inset"
            ? editor.previewInsetSelectedFaces(value)
            : operation === "bevel"
              ? editor.previewBevelSelectedElements(value)
              : editor.previewMoveSelectedAlongNormals(value),
      );
    } catch (error) {
      onPreview(undefined);
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  useEffect(() => () => onPreview(undefined), [onPreview]);
  const openModelingDialog = (operation: ModelingOperation) => {
    const value = modelingOperations[operation].defaultValue;
    setModelingOperation(operation);
    setModelingValue(value);
    previewModeling(operation, value);
  };
  const applyModeling = () => {
    if (!modelingOperation) return;
    try {
      if (modelingOperation === "extrude")
        editor.extrudeSelectedFaces(modelingValue);
      else if (modelingOperation === "inset")
        editor.insetSelectedFaces(modelingValue);
      else if (modelingOperation === "bevel")
        editor.bevelSelectedElements(modelingValue);
      else editor.moveSelectedAlongNormals(modelingValue);
      closeModelingDialog();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  const previewTransform = (
    operation: "move" | "rotate" | "scale",
    values: Values,
  ) => {
    try {
      onPreview(
        operation === "move"
          ? editor.previewTranslateSelected(values)
          : operation === "scale"
            ? editor.previewScaleSelected(values)
            : editor.previewRotateSelected({
                x: (values.x * Math.PI) / 180,
                y: (values.y * Math.PI) / 180,
                z: (values.z * Math.PI) / 180,
              }),
      );
    } catch (error) {
      onPreview(undefined);
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  const fields = (
    operation: "move" | "rotate" | "scale",
    values: Values,
    setValues: (value: Values) => void,
  ) => (
    <div className="vector-fields">
      {(["x", "y", "z"] as const).map((axis) => (
        <label key={axis}>
          <span>{axis.toUpperCase()}</span>
          <input
            aria-label={`${axis}軸`}
            type="number"
            step="0.1"
            value={values[axis]}
            onChange={(event) => {
              const next = {
                ...values,
                [axis]: Number(event.currentTarget.value),
              };
              setValues(next);
              if (Object.values(next).every(Number.isFinite))
                previewTransform(operation, next);
            }}
          />
        </label>
      ))}
    </div>
  );
  return (
    <div className="element-transform">
      <fieldset className="modeling-actions selection-actions">
        <legend>選択</legend>
        <button type="button" onClick={() => editor.growSelection()}>
          <Maximize2 aria-hidden="true" />
          拡張
        </button>
        <button type="button" onClick={() => editor.shrinkSelection()}>
          <Minimize2 aria-hidden="true" />
          縮小
        </button>
        <button type="button" onClick={() => editor.selectConnected()}>
          <Component aria-hidden="true" />
          連結
        </button>
        <button type="button" onClick={() => editor.selectEdgeLoop()}>
          <Waypoints aria-hidden="true" />
          ループ
        </button>
      </fieldset>
      <fieldset>
        <legend>相対移動</legend>
        {fields("move", move, setMove)}
        <button
          type="button"
          onClick={() => {
            editor.translateSelected(move);
            onPreview(undefined);
          }}
        >
          適用
        </button>
      </fieldset>
      <fieldset>
        <legend>回転（度）</legend>
        {fields("rotate", rotate, setRotate)}
        <button
          type="button"
          onClick={() =>
            run(() => {
              editor.rotateSelected({
                x: (rotate.x * Math.PI) / 180,
                y: (rotate.y * Math.PI) / 180,
                z: (rotate.z * Math.PI) / 180,
              });
              onPreview(undefined);
            })
          }
        >
          適用
        </button>
      </fieldset>
      <fieldset>
        <legend>スケール</legend>
        {fields("scale", scale, setScale)}
        <button
          type="button"
          onClick={() => {
            editor.scaleSelected(scale);
            onPreview(undefined);
          }}
        >
          適用
        </button>
      </fieldset>
      <fieldset className="modeling-actions">
        <legend>モデリング</legend>
        <button type="button" onClick={() => openModelingDialog("extrude")}>
          <Layers3 aria-hidden="true" />
          押し出し
        </button>
        <button type="button" onClick={() => openModelingDialog("inset")}>
          <Shrink aria-hidden="true" />
          インセット
        </button>
        <button type="button" onClick={() => openModelingDialog("bevel")}>
          <Slice aria-hidden="true" />
          ベベル
        </button>
        <button type="button" onClick={() => openModelingDialog("normalMove")}>
          <ArrowUpFromLine aria-hidden="true" />
          法線移動
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
          onClick={() => run(() => editor.loopCutSelectedEdges())}
        >
          <BetweenHorizontalEnd aria-hidden="true" />
          ループカット
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
        <button
          type="button"
          onClick={() => run(() => editor.separateSelectedFaces())}
        >
          <Ungroup aria-hidden="true" />
          面を分離
        </button>
      </fieldset>
      {modelingOperation && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="shortcut-dialog modeling-value-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modeling-value-dialog-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") closeModelingDialog();
            }}
          >
            <header>
              <h2 id="modeling-value-dialog-title">
                {modelingOperations[modelingOperation].title}
              </h2>
            </header>
            <p>{modelingOperations[modelingOperation].description}</p>
            <label className="scalar-field modeling-value-field">
              <span>{modelingOperations[modelingOperation].label}</span>
              <input
                autoFocus
                aria-label={modelingOperations[modelingOperation].label}
                type="number"
                step={modelingOperations[modelingOperation].step}
                min={modelingOperations[modelingOperation].min}
                max={modelingOperations[modelingOperation].max}
                value={modelingValue}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  setModelingValue(value);
                  if (Number.isFinite(value))
                    previewModeling(modelingOperation, value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyModeling();
                }}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={closeModelingDialog}>
                キャンセル
              </button>
              <button type="button" onClick={applyModeling}>
                {modelingOperations[modelingOperation].confirm}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
