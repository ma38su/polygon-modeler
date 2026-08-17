import { ArrowDown, ArrowUp, Layers3, Plus, Trash2 } from "lucide-react";
import type { Editor } from "../../editor/Editor";
import type {
  ModifierValue,
  ModelObjectSnapshot,
} from "../../editor/document/types";

const createModifier = (type: ModifierValue["type"]): ModifierValue => {
  const common = { id: crypto.randomUUID(), enabled: true };
  if (type === "mirror") return { ...common, type, axis: "x" };
  if (type === "array")
    return { ...common, type, count: 2, offset: { x: 2, y: 0, z: 0 } };
  if (type === "solidify") return { ...common, type, thickness: 0.1 };
  if (type === "bevel") return { ...common, type, amount: 0.1 };
  return { ...common, type, levels: 1 };
};

export function ModifierPanel({
  editor,
  object,
}: {
  editor: Editor;
  object: ModelObjectSnapshot;
}) {
  const modifiers = object.modifiers ?? [];
  const update = (next: readonly ModifierValue[]) =>
    editor.setObjectModifiers(object.id, next);
  const patch = (index: number, value: ModifierValue) =>
    update(
      modifiers.map((modifier, cursor) =>
        cursor === index ? value : modifier,
      ),
    );
  return (
    <div
      className="modifier-panel material-inspector"
      aria-label="モディファイア"
    >
      <h3>
        <Layers3 aria-hidden="true" />
        モディファイア
      </h3>
      <label>
        <span>追加</span>
        <select
          defaultValue=""
          onChange={(event) => {
            if (event.currentTarget.value)
              update([
                ...modifiers,
                createModifier(
                  event.currentTarget.value as ModifierValue["type"],
                ),
              ]);
            event.currentTarget.value = "";
          }}
        >
          <option value="">選択…</option>
          <option value="mirror">Mirror</option>
          <option value="array">Array</option>
          <option value="solidify">Solidify</option>
          <option value="bevel">Bevel</option>
          <option value="subdivision">Subdivision</option>
        </select>
      </label>
      {modifiers.map((modifier, index) => (
        <div className="modifier-item" key={modifier.id}>
          <label>
            <input
              type="checkbox"
              checked={modifier.enabled}
              onChange={() =>
                patch(index, { ...modifier, enabled: !modifier.enabled })
              }
            />
            {modifier.type}
          </label>
          {modifier.type === "mirror" && (
            <select
              value={modifier.axis}
              onChange={(event) =>
                patch(index, {
                  ...modifier,
                  axis: event.currentTarget.value as "x" | "y" | "z",
                })
              }
            >
              <option>x</option>
              <option>y</option>
              <option>z</option>
            </select>
          )}
          {modifier.type === "array" && (
            <input
              aria-label="Array数"
              type="number"
              min="1"
              max="100"
              value={modifier.count}
              onChange={(event) =>
                patch(index, {
                  ...modifier,
                  count: Number(event.currentTarget.value),
                })
              }
            />
          )}
          {modifier.type === "solidify" && (
            <input
              aria-label="厚み"
              type="number"
              step="0.05"
              value={modifier.thickness}
              onChange={(event) =>
                patch(index, {
                  ...modifier,
                  thickness: Number(event.currentTarget.value),
                })
              }
            />
          )}
          {modifier.type === "bevel" && (
            <input
              aria-label="Bevel量"
              type="number"
              min="0.001"
              max="0.49"
              step="0.01"
              value={modifier.amount}
              onChange={(event) =>
                patch(index, {
                  ...modifier,
                  amount: Number(event.currentTarget.value),
                })
              }
            />
          )}
          {modifier.type === "subdivision" && (
            <input
              aria-label="Subdivisionレベル"
              type="number"
              min="0"
              max="4"
              value={modifier.levels}
              onChange={(event) =>
                patch(index, {
                  ...modifier,
                  levels: Number(event.currentTarget.value),
                })
              }
            />
          )}
          <div className="modifier-actions">
            <button
              type="button"
              aria-label="上へ"
              disabled={index === 0}
              onClick={() => {
                const next = [...modifiers];
                [next[index - 1], next[index]] = [
                  next[index]!,
                  next[index - 1]!,
                ];
                update(next);
              }}
            >
              <ArrowUp aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="下へ"
              disabled={index === modifiers.length - 1}
              onClick={() => {
                const next = [...modifiers];
                [next[index], next[index + 1]] = [
                  next[index + 1]!,
                  next[index]!,
                ];
                update(next);
              }}
            >
              <ArrowDown aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="削除"
              onClick={() =>
                update(modifiers.filter((_, cursor) => cursor !== index))
              }
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={!modifiers.length}
        onClick={() => editor.applyObjectModifiers(object.id)}
      >
        <Plus aria-hidden="true" />
        スタックを適用
      </button>
      {modifiers.length > 0 && (
        <p className="inspector-hint">
          要素編集前にスタックを適用してください。
        </p>
      )}
    </div>
  );
}
