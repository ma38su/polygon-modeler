import type { MeshData } from "../../document/types";
export function createBoxMesh(size = 2): MeshData {
  const h = size / 2;
  return {
    positions: [
      -h,
      -h,
      -h,
      h,
      -h,
      -h,
      h,
      h,
      -h,
      -h,
      h,
      -h,
      -h,
      -h,
      h,
      h,
      -h,
      h,
      h,
      h,
      h,
      -h,
      h,
      h,
    ],
    faces: [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
      [0, 1, 5, 4],
      [3, 7, 6, 2],
    ],
  };
}
