import type { EdgeId, FaceId, VertexId } from "../document/types";
import type { EditableMesh } from "./EditableMesh";

export function moveElementsAlongNormals(
  mesh: EditableMesh,
  faceIds: ReadonlySet<FaceId>,
  edgeIds: ReadonlySet<EdgeId>,
  distance: number,
): EditableMesh {
  if (!Number.isFinite(distance)) throw new Error("法線移動量が不正です。");
  const affected = new Set<VertexId>();
  const contributingFaces = new Map<VertexId, Set<FaceId>>();
  const addFace = (vertex: VertexId, face: FaceId) => {
    const faces = contributingFaces.get(vertex) ?? new Set<FaceId>();
    faces.add(face);
    contributingFaces.set(vertex, faces);
  };
  for (const faceId of faceIds) {
    const face = mesh.faces.get(faceId);
    if (!face) continue;
    for (const vertex of face.vertices) {
      affected.add(vertex);
      addFace(vertex, faceId);
    }
  }
  for (const edgeId of edgeIds) {
    const edge = mesh.edges.get(edgeId);
    if (!edge) continue;
    for (const halfEdgeId of edge.halfEdges) {
      const halfEdge = mesh.halfEdges.get(halfEdgeId)!;
      affected.add(halfEdge.origin);
      affected.add(halfEdge.destination);
      addFace(halfEdge.origin, halfEdge.face);
      addFace(halfEdge.destination, halfEdge.face);
    }
  }
  const result = mesh.clone();
  result.setVertexPositions(
    new Map(
      [...affected].map((id) => {
        const position = mesh.vertices.get(id)!.position;
        const normal = [...(contributingFaces.get(id) ?? [])]
          .map((faceId) => faceNormal(mesh, faceId))
          .reduce(
            (sum, next) => ({
              x: sum.x + next.x,
              y: sum.y + next.y,
              z: sum.z + next.z,
            }),
            { x: 0, y: 0, z: 0 },
          );
        const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
        return [
          id,
          {
            x: position.x + (normal.x / length) * distance,
            y: position.y + (normal.y / length) * distance,
            z: position.z + (normal.z / length) * distance,
          },
        ] as const;
      }),
    ),
  );
  return result;
}

function faceNormal(mesh: EditableMesh, faceId: FaceId) {
  const face = mesh.faces.get(faceId)!;
  const [a, b, c] = face.vertices
    .slice(0, 3)
    .map((id) => mesh.vertices.get(id)!.position);
  const [ux, uy, uz] = [b!.x - a!.x, b!.y - a!.y, b!.z - a!.z];
  const [vx, vy, vz] = [c!.x - a!.x, c!.y - a!.y, c!.z - a!.z];
  return {
    x: uy * vz - uz * vy,
    y: uz * vx - ux * vz,
    z: ux * vy - uy * vx,
  };
}
