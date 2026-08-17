import { describe, expect, it } from "vitest";
import { EditableMesh } from "./EditableMesh";
import { createBoxMesh } from "./primitives/box";
import { diagnoseMesh } from "./meshDiagnostics";
import {
  mergeByDistance,
  recalculateFaceNormals,
  repairPolygonWinding,
} from "./repairOperations";

describe("mesh repair operations", () => {
  it("welds nearby vertices and creates shared topology", () => {
    const mesh = EditableMesh.fromPolygons(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 1.00001, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1.00001, z: 0 },
      ],
      [
        [0, 1, 2],
        [3, 4, 5],
      ],
    );
    const repaired = mergeByDistance(mesh, 0.001);
    expect(repaired.vertices.size).toBe(4);
    expect(repaired.edges.size).toBe(5);
    expect(diagnoseMesh(repaired.toMeshData()).boundaryEdges).toBe(4);
  });

  it("orients a closed component outward", () => {
    const source = createBoxMesh().toMeshData();
    const reversed = EditableMesh.fromPolygons(
      source.vertexIds.map((_, index) => ({
        x: source.positions[index * 3]!,
        y: source.positions[index * 3 + 1]!,
        z: source.positions[index * 3 + 2]!,
      })),
      source.faces.map((face) => [...face].reverse()),
    );
    const repaired = recalculateFaceNormals(reversed);
    const data = repaired.toMeshData();
    const top = data.faces.find((face) =>
      face.every((index) => data.positions[index * 3 + 1] === 1),
    )!;
    expect(top).toBeDefined();
    expect(top).toEqual([3, 7, 6, 2]);
  });

  it("repairs inconsistent adjacent open polygons before mesh construction", () => {
    const positions = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 },
    ];
    const faces = repairPolygonWinding(positions, [
      [0, 1, 2],
      [1, 2, 3],
    ]);
    expect(() => EditableMesh.fromPolygons(positions, faces)).not.toThrow();
    expect(faces[1]).toEqual([3, 2, 1]);
  });

  it("handles many disconnected faces without quadratic component scans", () => {
    const faceCount = 2_000;
    const positions = Array.from({ length: faceCount * 3 }, (_, index) => ({
      x: index,
      y: index % 3 === 1 ? 1 : 0,
      z: 0,
    }));
    const polygons = Array.from({ length: faceCount }, (_, index) => [
      index * 3,
      index * 3 + 1,
      index * 3 + 2,
    ]);
    expect(repairPolygonWinding(positions, polygons)).toHaveLength(faceCount);
  });
});
