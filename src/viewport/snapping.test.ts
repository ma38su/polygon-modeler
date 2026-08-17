import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { findVertexSnap } from "./snapping";

describe("findVertexSnap", () => {
  it("snaps every coordinate to the nearest vertex", () => {
    expect(
      findVertexSnap(
        new Vector3(1, 1, 1),
        [new Vector3(1.1, 1.1, 1.1), new Vector3(2, 2, 2)],
        "all",
        0.3,
      )?.toArray(),
    ).toEqual([1.1, 1.1, 1.1]);
  });

  it("changes only the constrained axis", () => {
    expect(
      findVertexSnap(
        new Vector3(1, 5, 8),
        [new Vector3(1.1, 20, 30)],
        "x",
        0.3,
      )?.toArray(),
    ).toEqual([1.1, 5, 8]);
  });
});
