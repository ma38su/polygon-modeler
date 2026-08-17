import {
  DEFAULT_LIGHTING_SETTINGS,
  type EnvironmentPreset,
  type LightingSettings,
} from "../../viewport/Viewport";

export interface LightingPanelProps {
  value: LightingSettings;
  onChange(value: LightingSettings): void;
}

const environmentLabels: Record<EnvironmentPreset, string> = {
  none: "なし",
  studio: "スタジオ",
  sunset: "夕景",
  night: "夜景",
};

export function LightingPanel({ value, onChange }: LightingPanelProps) {
  const update = <K extends keyof LightingSettings>(
    key: K,
    next: LightingSettings[K],
  ) => onChange({ ...value, [key]: next });
  const range = (
    label: string,
    key: "environmentIntensity" | "hemisphereIntensity" | "keyLightIntensity",
    max: number,
  ) => (
    <label className="inspector-field">
      <span>{label}</span>
      <input
        type="range"
        min="0"
        max={max}
        step="0.05"
        value={value[key]}
        onChange={(event) => update(key, Number(event.target.value))}
      />
      <input
        type="number"
        min="0"
        max={max}
        step="0.05"
        value={value[key]}
        onChange={(event) => update(key, Number(event.target.value))}
      />
    </label>
  );
  return (
    <fieldset className="inspector-section lighting-panel">
      <legend>環境・ライト</legend>
      <label className="inspector-field">
        <span>環境マップ</span>
        <select
          value={value.environment}
          onChange={(event) =>
            update("environment", event.target.value as EnvironmentPreset)
          }
        >
          {Object.entries(environmentLabels).map(([preset, label]) => (
            <option key={preset} value={preset}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {range("環境光", "environmentIntensity", 3)}
      {range("補助光", "hemisphereIntensity", 4)}
      {range("キーライト", "keyLightIntensity", 6)}
      <label className="inspector-field">
        <span>ライト色</span>
        <input
          type="color"
          value={value.keyLightColor}
          onChange={(event) => update("keyLightColor", event.target.value)}
        />
      </label>
      <button type="button" onClick={() => onChange(DEFAULT_LIGHTING_SETTINGS)}>
        初期値に戻す
      </button>
    </fieldset>
  );
}
