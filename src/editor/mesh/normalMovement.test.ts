import { describe, expect, it } from "vitest";
import { createPlaneMesh } from "./primitives/plane";
import { moveElementsAlongNormals } from "./normalMovement";

describe("normal movement", () => {
  it("moves a selected face along its winding normal", () => {
    const mesh = createPlaneMesh();
    const moved = moveElementsAlongNormals(
      mesh,
      new Set(mesh.faces.keys()),
      new Set(),
      1,
    );
    expect(
      [...moved.vertices.values()].every((vertex) => vertex.position.y === 1),
    ).toBe(true);
    expect(
      [...mesh.vertices.values()].every((vertex) => vertex.position.y === 0),
    ).toBe(true);
  });

  it("moves only the endpoints of a selected edge", () => {
    const mesh = createPlaneMesh();
    const moved = moveElementsAlongNormals(
      mesh,
      new Set(),
      new Set([[...mesh.edges.keys()][0]!]),
      0.5,
    );
    expect(
      [...moved.vertices.values()].filter(
        (vertex) => vertex.position.y === 0.5,
      ),
    ).toHaveLength(2);
  });
});
