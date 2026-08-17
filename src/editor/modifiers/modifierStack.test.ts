import { describe, expect, it } from "vitest";
import { createBoxMesh } from "../mesh/primitives/box";
import { createPlaneMesh } from "../mesh/primitives/plane";
import { validateMesh } from "../mesh/validateMesh";
import { evaluateModifier, evaluateModifierStack } from "./modifierStack";

describe("modifier stack", () => {
  it("evaluates enabled modifiers in stack order without changing the source", () => {
    const source = createPlaneMesh();
    const result = evaluateModifierStack(source, [
      { id: "solid", type: "solidify", thickness: 0.2, enabled: true },
      {
        id: "array",
        type: "array",
        count: 2,
        offset: { x: 3, y: 0, z: 0 },
        enabled: true,
      },
    ]);
    expect(source.faces.size).toBe(1);
    expect(result.faces.size).toBe(12);
    expect(validateMesh(result).valid).toBe(true);
  });

  it("supports mirror, subdivision, and bevel evaluation", () => {
    const box = createBoxMesh();
    const mirrored = evaluateModifier(box, {
      id: "m",
      type: "mirror",
      axis: "x",
      enabled: true,
    });
    const subdivided = evaluateModifier(box, {
      id: "s",
      type: "subdivision",
      levels: 1,
      enabled: true,
    });
    const beveled = evaluateModifier(box, {
      id: "b",
      type: "bevel",
      amount: 0.1,
      enabled: true,
    });
    expect(mirrored.faces.size).toBe(12);
    expect(subdivided.faces.size).toBe(24);
    expect(beveled.faces.size).toBeGreaterThan(box.faces.size);
    expect(
      [mirrored, subdivided, beveled].every((mesh) => validateMesh(mesh).valid),
    ).toBe(true);
  });
});
