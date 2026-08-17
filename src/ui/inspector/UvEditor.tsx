import type { ModelObjectSnapshot } from "../../editor/document/types";

export function UvEditor({ object }: { object?: ModelObjectSnapshot }) {
  const polygons = (object?.mesh.faceUvs ?? []).flatMap((face, index) =>
    face.length >= 3 && face.every(Boolean)
      ? [{ index, points: face.map((uv) => `${uv!.u},${1 - uv!.v}`).join(" ") }]
      : [],
  );
  return (
    <div className="uv-editor" aria-label="UVエディター">
      <div className="uv-checker" aria-hidden="true" />
      <svg viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet">
        {polygons.map(({ index, points }) => (
          <polygon key={index} points={points} />
        ))}
      </svg>
      {!polygons.length && <span>面を選択してUV投影してください</span>}
    </div>
  );
}
