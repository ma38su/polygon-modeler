import { describe, expect, it } from "vitest";
import { createBoxMesh } from "./primitives/box";
import { createPlaneMesh } from "./primitives/plane";
import {
  extrudeFaces,
  flipFaces,
  insetFaces,
  mergeVertices,
  splitEdge,
  splitFace,
} from "./topologyOperations";
import { validateMesh } from "./validateMesh";

describe("topology operations", () => {
  it("extrudes a single boundary face", () => {
    const mesh = createPlaneMesh();
    const result = extrudeFaces(mesh, new Set(mesh.faces.keys()), 1);
    expect(result.faces.size).toBe(5);
    expect(result.vertices.size).toBe(8);
    expect(validateMesh(result).valid).toBe(true);
  });
  it("extrudes adjacent faces as one region without an internal wall", () => {
    const mesh = createBoxMesh();
    const faceIds = [...mesh.faces.keys()];
    const first = mesh.faces.get(faceIds[0]!)!;
    const adjacent = [...mesh.faces.values()].find(
      (face) =>
        face.id !== first.id &&
        face.vertices.filter((vertex) => first.vertices.includes(vertex))
          .length === 2,
    )!;
    const faces = [first.id, adjacent.id];
    const result = extrudeFaces(mesh, new Set(faces), 0.5);
    expect(validateMesh(result).valid).toBe(true);
    expect(result.faces.size).toBeGreaterThan(mesh.faces.size);
  });
  it("insets a face with an inner face and surrounding ring", () => {
    const mesh = createPlaneMesh();
    const result = insetFaces(mesh, new Set(mesh.faces.keys()), 0.25);
    expect(result.vertices.size).toBe(8);
    expect(result.faces.size).toBe(5);
    expect(validateMesh(result).valid).toBe(true);
  });
  it("splits a face into triangles", () => {
    const mesh = createPlaneMesh();
    const result = splitFace(mesh, [...mesh.faces.keys()][0]!);
    expect(result.faces.size).toBe(4);
    expect(validateMesh(result).valid).toBe(true);
  });
  it("splits an edge on every incident face", () => {
    const mesh = createBoxMesh();
    const result = splitEdge(mesh, [...mesh.edges.keys()][0]!);
    expect(result.vertices.size).toBe(9);
    expect(validateMesh(result).valid).toBe(true);
  });
  it("flips faces and merges vertices without corruption", () => {
    const mesh = createPlaneMesh();
    const flipped = flipFaces(mesh, new Set(mesh.faces.keys()));
    const ids = [...flipped.vertices.keys()];
    const merged = mergeVertices(flipped, ids[0]!, ids[1]!);
    expect(validateMesh(merged).valid).toBe(true);
  });
});
