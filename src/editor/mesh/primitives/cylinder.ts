import { EditableMesh } from "../EditableMesh";
export function createCylinderMesh(
  radius = 1,
  height = 2,
  segments = 16,
): EditableMesh {
  if (!Number.isInteger(segments) || segments < 3)
    throw new Error("Cylinder requires at least three segments");
  const positions = [];
  const half = height / 2;
  for (let level = 0; level < 2; level += 1)
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      positions.push({
        x: Math.cos(angle) * radius,
        y: level === 0 ? -half : half,
        z: Math.sin(angle) * radius,
      });
    }
  const bottom = Array.from({ length: segments }, (_, i) => segments - 1 - i);
  const top = Array.from({ length: segments }, (_, i) => segments + i);
  const sides = Array.from({ length: segments }, (_, i) => {
    const next = (i + 1) % segments;
    return [i, next, segments + next, segments + i];
  });
  return EditableMesh.fromPolygons(positions, [bottom, top, ...sides]);
}
