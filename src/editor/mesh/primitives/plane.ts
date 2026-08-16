import { EditableMesh } from "../EditableMesh";
export function createPlaneMesh(size = 2): EditableMesh {
  const h = size / 2;
  return EditableMesh.fromPolygons(
    [
      { x: -h, y: 0, z: -h },
      { x: h, y: 0, z: -h },
      { x: h, y: 0, z: h },
      { x: -h, y: 0, z: h },
    ],
    [[0, 3, 2, 1]],
  );
}
