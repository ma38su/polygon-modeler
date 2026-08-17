import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { findScreenSnap, findVertexSnap } from "./snapping";

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

describe("findScreenSnap", () => {
  it("uses a stable pixel threshold instead of world distance", () => {
    const candidate = new Vector3(100, 100, 100);
    const project = (point: Vector3) =>
      point === candidate ? new Vector3(0.01, 0, 0) : new Vector3(0, 0, 0);
    expect(
      findScreenSnap(
        new Vector3(),
        [candidate],
        project,
        { width: 1000, height: 500 },
        "all",
        6,
      )?.toArray(),
    ).toEqual([100, 100, 100]);
  });
});
