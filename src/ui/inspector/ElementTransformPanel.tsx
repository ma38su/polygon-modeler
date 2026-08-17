import { useEffect, useState } from "react";
import type { Editor } from "../../editor/Editor";
import type { ModelObjectSnapshot } from "../../editor/document/types";
import type { NormalHandleOperation } from "../../viewport/Viewport";
import type { TransformOrientation } from "../../viewport/transform/elementSelection";
import { UvEditor } from "./UvEditor";
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
type ModelingOperation =
  "extrude" | "inset" | "bevel" | "normalMove" | "knife" | "loopCut";
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
  knife: {
    title: "Knifeで面を切断",
    description: "選択Faceの向かい合う境界Edge上を結ぶ切断Edgeを作成します。",
    label: "辺上の位置",
    confirm: "切断",
    defaultValue: 0.5,
    step: 0.05,
    min: 0.01,
    max: 0.99,
  },
  loopCut: {
    title: "Loop Cut",
    description: "選択Edge Ringを横切る新しいEdge Loopを作成します。",
    label: "カット位置",
    confirm: "ループカット",
    defaultValue: 0.5,
    step: 0.05,
    min: 0.01,
    max: 0.99,
  },
};
export function ElementTransformPanel({
  editor,
  onError,
  onPreview,
  normalOperation,
  onNormalOperationChange,
  canExtrude,
  canNormalMove,
  transformOrientation,
  knifeActive,
  onKnifeActiveChange,
  object,
}: {
  editor: Editor;
  onError(message: string): void;
  onPreview(objects?: readonly ModelObjectSnapshot[]): void;
  normalOperation?: NormalHandleOperation;
  onNormalOperationChange(operation: NormalHandleOperation): void;
  canExtrude: boolean;
  canNormalMove: boolean;
  transformOrientation: TransformOrientation;
  knifeActive: boolean;
  onKnifeActiveChange(active: boolean): void;
  object?: ModelObjectSnapshot;
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
              : operation === "normalMove"
                ? editor.previewMoveSelectedAlongNormals(value)
                : operation === "knife"
                  ? editor.previewKnifeSelectedFace(value)
                  : editor.previewLoopCutSelectedEdges(value),
      );
    } catch (error) {
      onPreview(undefined);
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  useEffect(() => () => onPreview(undefined), [onPreview]);
  const openModelingDialog = (operation: ModelingOperation) => {
    if (normalOperation) onNormalOperationChange(normalOperation);
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
      else if (modelingOperation === "normalMove")
        editor.moveSelectedAlongNormals(modelingValue);
      else if (modelingOperation === "knife")
        editor.knifeSelectedFace(modelingValue);
      else editor.loopCutSelectedEdges(modelingValue);
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
        editor.previewTransformSelectedInFrame(
          operation === "move" ? "translate" : operation,
          operation === "rotate"
            ? {
                x: (values.x * Math.PI) / 180,
                y: (values.y * Math.PI) / 180,
                z: (values.z * Math.PI) / 180,
              }
            : values,
          transformOrientation,
        ),
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
        <button type="button" onClick={() => editor.selectEdgeRing()}>
          <BetweenHorizontalEnd aria-hidden="true" />
          リング
        </button>
      </fieldset>
      <fieldset>
        <legend>相対移動</legend>
        {fields("move", move, setMove)}
        <button
          type="button"
          onClick={() => {
            editor.transformSelectedInFrame(
              "translate",
              move,
              transformOrientation,
            );
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
              editor.transformSelectedInFrame(
                "rotate",
                {
                  x: (rotate.x * Math.PI) / 180,
                  y: (rotate.y * Math.PI) / 180,
                  z: (rotate.z * Math.PI) / 180,
                },
                transformOrientation,
              );
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
            editor.transformSelectedInFrame(
              "scale",
              scale,
              transformOrientation,
            );
            onPreview(undefined);
          }}
        >
          適用
        </button>
      </fieldset>
      <fieldset className="modeling-actions">
        <legend>モデリング</legend>
        <button
          type="button"
          className={normalOperation === "extrude" ? "active" : undefined}
          aria-pressed={normalOperation === "extrude"}
          disabled={!canExtrude}
          onClick={() => onNormalOperationChange("extrude")}
        >
          <Layers3 aria-hidden="true" />
          押し出し操作
        </button>
        <button
          type="button"
          disabled={!canExtrude}
          onClick={() => openModelingDialog("extrude")}
        >
          <Layers3 aria-hidden="true" />
          押し出し数値
        </button>
        <button type="button" onClick={() => openModelingDialog("inset")}>
          <Shrink aria-hidden="true" />
          インセット
        </button>
        <button type="button" onClick={() => openModelingDialog("bevel")}>
          <Slice aria-hidden="true" />
          ベベル
        </button>
        <button
          type="button"
          className={normalOperation === "normalMove" ? "active" : undefined}
          aria-pressed={normalOperation === "normalMove"}
          disabled={!canNormalMove}
          onClick={() => onNormalOperationChange("normalMove")}
        >
          <ArrowUpFromLine aria-hidden="true" />
          法線移動操作
        </button>
        <button
          type="button"
          disabled={!canNormalMove}
          onClick={() => openModelingDialog("normalMove")}
        >
          <ArrowUpFromLine aria-hidden="true" />
          法線移動数値
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
          onClick={() => run(() => editor.dissolveSelectedElements())}
        >
          <Ungroup aria-hidden="true" />
          Dissolve
        </button>
        <button
          type="button"
          onClick={() => run(() => editor.fillSelectedBoundary())}
        >
          <SquareDashed aria-hidden="true" />
          Fill
        </button>
        <button
          type="button"
          onClick={() => run(() => editor.bridgeSelectedEdgeLoops())}
        >
          <Combine aria-hidden="true" />
          Bridge
        </button>
        <button
          type="button"
          className={knifeActive ? "active" : undefined}
          aria-pressed={knifeActive}
          onClick={() => onKnifeActiveChange(!knifeActive)}
        >
          <Scissors aria-hidden="true" />
          Knife操作
        </button>
        <button type="button" onClick={() => openModelingDialog("knife")}>
          <Scissors aria-hidden="true" />
          Knife数値
        </button>
        <button type="button" onClick={() => openModelingDialog("loopCut")}>
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
      <fieldset className="modeling-actions selection-actions">
        <legend>UV</legend>
        <UvEditor object={object} />
        {(["xy", "xz", "yz"] as const).map((plane) => (
          <button
            type="button"
            key={plane}
            onClick={() => run(() => editor.projectSelectedFacesUv(plane))}
          >
            <Layers3 aria-hidden="true" />
            {plane.toUpperCase()}投影
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            run(() =>
              editor.transformSelectedFacesUv({
                rotation: Math.PI / 2,
              }),
            )
          }
        >
          <FlipVertical2 aria-hidden="true" />
          UV 90°回転
        </button>
        <button
          type="button"
          onClick={() =>
            run(() =>
              editor.transformSelectedFacesUv({ scale: { u: 0.5, v: 0.5 } }),
            )
          }
        >
          <Minimize2 aria-hidden="true" />
          UV縮小
        </button>
        <button
          type="button"
          onClick={() =>
            run(() =>
              editor.transformSelectedFacesUv({ scale: { u: 2, v: 2 } }),
            )
          }
        >
          <Maximize2 aria-hidden="true" />
          UV拡大
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
