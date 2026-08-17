import type { MeshData, Vector3Value } from "../document/types";

export interface MeshDiagnostics {
  readonly boundaryEdges: number;
  readonly nonManifoldEdges: number;
  readonly degenerateFaces: number;
  readonly isolatedVertices: number;
  readonly closed: boolean;
  readonly healthy: boolean;
}

export interface FaceNormalSegment {
  readonly center: Vector3Value;
  readonly normal: Vector3Value;
}

export function diagnoseMesh(mesh: MeshData): MeshDiagnostics {
  const edgeUse = new Map<string, number>();
  const usedVertices = new Set<number>();
  let degenerateFaces = 0;
  for (const face of mesh.faces) {
    face.forEach((from, index) => {
      usedVertices.add(from);
      const to = face[(index + 1) % face.length]!;
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
    });
    if (faceNormalSegment(mesh, face).normalLengthSquared < 1e-16)
      degenerateFaces += 1;
  }
  const boundaryEdges = [...edgeUse.values()].filter(
    (count) => count === 1,
  ).length;
  const nonManifoldEdges = [...edgeUse.values()].filter(
    (count) => count > 2,
  ).length;
  const isolatedVertices = mesh.vertexIds.length - usedVertices.size;
  return {
    boundaryEdges,
    nonManifoldEdges,
    degenerateFaces,
    isolatedVertices,
    closed: edgeUse.size > 0 && boundaryEdges === 0 && nonManifoldEdges === 0,
    healthy:
      nonManifoldEdges === 0 && degenerateFaces === 0 && isolatedVertices === 0,
  };
}

export function collectFaceNormalSegments(mesh: MeshData): FaceNormalSegment[] {
  return mesh.faces.flatMap((face) => {
    const { center, normal, normalLengthSquared } = faceNormalSegment(
      mesh,
      face,
    );
    return normalLengthSquared < 1e-16 ? [] : [{ center, normal }];
  });
}

function faceNormalSegment(
  mesh: MeshData,
  face: readonly number[],
): {
  center: Vector3Value;
  normal: Vector3Value;
  normalLengthSquared: number;
} {
  const center = face.reduce(
    (sum, index) => ({
      x: sum.x + mesh.positions[index * 3]! / face.length,
      y: sum.y + mesh.positions[index * 3 + 1]! / face.length,
      z: sum.z + mesh.positions[index * 3 + 2]! / face.length,
    }),
    { x: 0, y: 0, z: 0 },
  );
  // Newell's method remains stable for arbitrary planar n-gons.
  const normal = { x: 0, y: 0, z: 0 };
  face.forEach((currentIndex, index) => {
    const nextIndex = face[(index + 1) % face.length]!;
    const current = point(mesh, currentIndex);
    const next = point(mesh, nextIndex);
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  });
  const normalLengthSquared = normal.x ** 2 + normal.y ** 2 + normal.z ** 2;
  const length = Math.sqrt(normalLengthSquared) || 1;
  return {
    center,
    normal: {
      x: normal.x / length,
      y: normal.y / length,
      z: normal.z / length,
    },
    normalLengthSquared,
  };
}

function point(mesh: MeshData, index: number): Vector3Value {
  return {
    x: mesh.positions[index * 3]!,
    y: mesh.positions[index * 3 + 1]!,
    z: mesh.positions[index * 3 + 2]!,
  };
}
