import type { Editor } from "../../editor/Editor";
import type {
  ModelObjectSnapshot,
  TransformValue,
  Vector3Value,
} from "../../editor/document/types";
import type { TransformOrientation } from "../../viewport/transform/elementSelection";
type VectorKey = "position" | "rotation" | "scale";
type Axis = keyof Vector3Value;
export function TransformInspector({
  editor,
  objects,
  orientation,
}: {
  editor: Editor;
  objects: readonly ModelObjectSnapshot[];
  orientation: TransformOrientation;
}) {
  const object = objects[0]!;
  if (objects.length > 1)
    return (
      <div className="transform-inspector">
        <p className="inspector-hint">
          {objects.length}個のObjectを共通重心から{orientation.toUpperCase()}
          軸で変形
        </p>
        {(
          [
            ["translate", "移動量", 0],
            ["rotate", "回転量 (rad)", 0],
            ["scale", "倍率", 1],
          ] as const
        ).map(([mode, label, initial]) => (
          <fieldset key={mode}>
            <legend>{label}</legend>
            <div className="vector-fields">
              {(["x", "y", "z"] as const).map((axis) => (
                <label key={axis}>
                  <span>{axis.toUpperCase()}</span>
                  <input
                    type="number"
                    step="0.1"
                    defaultValue={initial}
                    onBlur={(event) => {
                      const value = Number(event.currentTarget.value);
                      if (!Number.isFinite(value) || value === initial) return;
                      editor.transformSelectedObjectsInFrame(
                        mode,
                        {
                          x: axis === "x" ? value : initial,
                          y: axis === "y" ? value : initial,
                          z: axis === "z" ? value : initial,
                        },
                        orientation,
                      );
                      event.currentTarget.value = String(initial);
                    }}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    );
  const commit = (key: VectorKey, axis: Axis, value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const transform: TransformValue = {
      ...object.transform,
      [key]: { ...object.transform[key], [axis]: parsed },
    };
    editor.transformObject(object.id, transform);
  };
  return (
    <div className="transform-inspector">
      {(["position", "rotation", "scale"] as const).map((key) => (
        <fieldset key={key}>
          <legend>
            {key === "position"
              ? "位置"
              : key === "rotation"
                ? "回転"
                : "スケール"}
          </legend>
          <div className="vector-fields">
            {(["x", "y", "z"] as const).map((axis) => (
              <label key={axis}>
                <span>{axis.toUpperCase()}</span>
                <input
                  type="number"
                  step="0.1"
                  defaultValue={object.transform[key][axis]}
                  key={`${object.id}-${key}-${axis}-${object.transform[key][axis]}`}
                  onBlur={(event) =>
                    commit(key, axis, event.currentTarget.value)
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
