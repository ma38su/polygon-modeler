import type { Editor } from "../../editor/Editor";
import type {
  ModelObjectSnapshot,
  TransformValue,
  Vector3Value,
} from "../../editor/document/types";
type VectorKey = "position" | "rotation" | "scale";
type Axis = keyof Vector3Value;
export function TransformInspector({
  editor,
  object,
}: {
  editor: Editor;
  object: ModelObjectSnapshot;
}) {
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
