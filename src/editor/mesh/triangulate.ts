import type { MeshData } from "../document/types";
export function triangulate(mesh: MeshData): number[] {
  const vertexCount = mesh.positions.length / 3;
  const indices: number[] = [];
  for (const face of mesh.faces) {
    if (face.length < 3)
      throw new Error(
        "Cannot triangulate a face with fewer than three vertices",
      );
    for (const index of face)
      if (!Number.isInteger(index) || index < 0 || index >= vertexCount)
        throw new Error(`Face index out of range: ${index}`);
    for (let cursor = 1; cursor < face.length - 1; cursor += 1)
      indices.push(face[0]!, face[cursor]!, face[cursor + 1]!);
  }
  return indices;
}
