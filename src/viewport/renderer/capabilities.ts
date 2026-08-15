export type RendererPreference = "auto" | "webgpu" | "webgl2";
export type RendererBackend = "webgpu" | "webgl2";

export function getRendererPreference(search: string): RendererPreference {
  const value = new URLSearchParams(search).get("renderer");
  return value === "webgpu" || value === "webgl2" ? value : "auto";
}

export function canUseWebGpu(navigatorValue: Navigator): boolean {
  return "gpu" in navigatorValue;
}
