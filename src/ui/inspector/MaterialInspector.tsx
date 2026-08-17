import { Paintbrush } from "lucide-react";
import type { Editor } from "../../editor/Editor";
import type {
  MaterialValue,
  ModelObjectSnapshot,
  ShadingModel,
} from "../../editor/document/types";

export function MaterialInspector({
  editor,
  object,
}: {
  editor: Editor;
  object: ModelObjectSnapshot;
}) {
  const commit = (patch: Partial<MaterialValue>) =>
    editor.setObjectMaterial(object.id, { ...object.material, ...patch });
  const physical = object.material.shading === "standard";
  const setTexture = (
    slot: "baseColor" | "normal" | "roughness" | "metalness",
    file?: File,
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      commit({
        textures: {
          ...object.material.textures,
          [slot]: {
            source: String(reader.result),
            name: file.name,
            colorSpace: slot === "baseColor" ? "srgb" : "linear",
          },
        },
      });
    reader.readAsDataURL(file);
  };

  return (
    <div className="material-inspector" aria-label="マテリアル">
      <h3>
        <Paintbrush aria-hidden="true" />
        マテリアル
      </h3>
      <label>
        <span>色</span>
        <input
          type="color"
          aria-label="マテリアル色"
          value={object.material.color}
          onChange={(event) => commit({ color: event.currentTarget.value })}
        />
      </label>
      <label>
        <span>シェーディング</span>
        <select
          aria-label="シェーディング"
          value={object.material.shading}
          onChange={(event) =>
            commit({ shading: event.currentTarget.value as ShadingModel })
          }
        >
          <option value="basic">Basic（非照明）</option>
          <option value="lambert">Lambert（Gouraud系）</option>
          <option value="phong">Phong</option>
          <option value="standard">PBR Standard</option>
        </select>
      </label>
      <label className={!physical ? "disabled" : undefined}>
        <span>粗さ</span>
        <input
          type="number"
          aria-label="粗さ"
          min="0"
          max="1"
          step="0.05"
          disabled={!physical}
          defaultValue={object.material.roughness}
          key={`${object.id}-roughness-${object.material.roughness}`}
          onBlur={(event) =>
            commit({ roughness: Number(event.currentTarget.value) })
          }
        />
      </label>
      {(
        [
          ["baseColor", "Base Color画像"],
          ["normal", "Normal画像"],
          ["roughness", "Roughness画像"],
          ["metalness", "Metalness画像"],
        ] as const
      ).map(([slot, label]) => (
        <label
          key={slot}
          className={slot !== "baseColor" && !physical ? "disabled" : undefined}
        >
          <span>{label}</span>
          <input
            type="file"
            accept="image/*"
            disabled={slot !== "baseColor" && !physical}
            aria-label={label}
            onChange={(event) => {
              setTexture(slot, event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
      ))}
      <label className={!physical ? "disabled" : undefined}>
        <span>金属度</span>
        <input
          type="number"
          aria-label="金属度"
          min="0"
          max="1"
          step="0.05"
          disabled={!physical}
          defaultValue={object.material.metalness}
          key={`${object.id}-metalness-${object.material.metalness}`}
          onBlur={(event) =>
            commit({ metalness: Number(event.currentTarget.value) })
          }
        />
      </label>
    </div>
  );
}
