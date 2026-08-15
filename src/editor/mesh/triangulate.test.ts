import { describe, expect, it } from "vitest";
import { triangulate } from "./triangulate";
describe("triangulate", () => {
  it("triangulates an n-gon deterministically", () => {
    const mesh = {
      positions: [0, 0, 0, 1, 0, 0, 2, 1, 0, 1, 2, 0, 0, 1, 0],
      faces: [[0, 1, 2, 3, 4]],
      revision: 1,
    };
    expect(triangulate(mesh)).toEqual([0, 1, 2, 0, 2, 3, 0, 3, 4]);
    expect(triangulate(mesh)).toEqual(triangulate(mesh));
  });
  it("rejects invalid render indices", () =>
    expect(() =>
      triangulate({ positions: [0, 0, 0], faces: [[0, 1, 2]], revision: 1 }),
    ).toThrow("out of range"));
});
