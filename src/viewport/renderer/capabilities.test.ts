import { describe, expect, it } from "vitest";
import { getRendererPreference } from "./capabilities";

describe("renderer preference", () => {
  it("defaults to auto", () => expect(getRendererPreference("")).toBe("auto"));
  it("accepts a forced WebGL 2 backend", () =>
    expect(getRendererPreference("?renderer=webgl2")).toBe("webgl2"));
  it("ignores unknown backends", () =>
    expect(getRendererPreference("?renderer=other")).toBe("auto"));
});
