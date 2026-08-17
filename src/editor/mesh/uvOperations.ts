import type { FaceId } from "../document/types";
import type { EditableMesh, MeshHalfEdge } from "./EditableMesh";

export type UvProjectionPlane = "xy" | "xz" | "yz";

/** Planar-project selected faces and normalize the result into the 0..1 tile. */
export function projectUv(
  source: EditableMesh,
  faceIds: ReadonlySet<FaceId>,
  plane: UvProjectionPlane,
): EditableMesh {
  const mesh = source.clone();
  const corners = selectedCorners(mesh, faceIds);
  if (!corners.length) return mesh;
  const projected = corners.map((halfEdge) => {
    const point = mesh.vertices.get(halfEdge.origin)!.position;
    if (plane === "xy") return { u: point.x, v: point.y };
    if (plane === "xz") return { u: point.x, v: point.z };
    return { u: point.z, v: point.y };
  });
  const minU = Math.min(...projected.map(({ u }) => u));
  const maxU = Math.max(...projected.map(({ u }) => u));
  const minV = Math.min(...projected.map(({ v }) => v));
  const maxV = Math.max(...projected.map(({ v }) => v));
  const width = maxU - minU || 1;
  const height = maxV - minV || 1;
  corners.forEach((halfEdge, index) => {
    const uv = projected[index]!;
    halfEdge.uv = { u: (uv.u - minU) / width, v: (uv.v - minV) / height };
  });
  return mesh;
}

/** Apply a 2D transform around a UV-space pivot. */
export function transformUv(
  source: EditableMesh,
  faceIds: ReadonlySet<FaceId>,
  options: {
    readonly translation?: { readonly u: number; readonly v: number };
    readonly rotation?: number;
    readonly scale?: { readonly u: number; readonly v: number };
    readonly pivot?: { readonly u: number; readonly v: number };
  },
): EditableMesh {
  const mesh = source.clone();
  const corners = selectedCorners(mesh, faceIds).filter((corner) => corner.uv);
  if (!corners.length) return mesh;
  const pivot = options.pivot ?? {
    u: corners.reduce((sum, corner) => sum + corner.uv!.u, 0) / corners.length,
    v: corners.reduce((sum, corner) => sum + corner.uv!.v, 0) / corners.length,
  };
  const scale = options.scale ?? { u: 1, v: 1 };
  const translation = options.translation ?? { u: 0, v: 0 };
  const angle = options.rotation ?? 0;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  for (const corner of corners) {
    const x = (corner.uv!.u - pivot.u) * scale.u;
    const y = (corner.uv!.v - pivot.v) * scale.v;
    corner.uv = {
      u: pivot.u + x * cosine - y * sine + translation.u,
      v: pivot.v + x * sine + y * cosine + translation.v,
    };
  }
  return mesh;
}

function selectedCorners(
  mesh: EditableMesh,
  faceIds: ReadonlySet<FaceId>,
): MeshHalfEdge[] {
  return [...mesh.halfEdges.values()].filter((halfEdge) =>
    faceIds.has(halfEdge.face),
  );
}
