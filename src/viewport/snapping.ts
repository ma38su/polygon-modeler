import { Vector3 } from "three";
import type { AxisConstraint } from "./Viewport";

export function findVertexSnap(
  current: Vector3,
  candidates: readonly Vector3[],
  constraint: AxisConstraint,
  threshold: number,
): Vector3 | undefined {
  let closest: Vector3 | undefined;
  let closestDistance = threshold;
  for (const point of candidates) {
    const dx =
      constraint === "all" || constraint === "x" ? point.x - current.x : 0;
    const dy =
      constraint === "all" || constraint === "y" ? point.y - current.y : 0;
    const dz =
      constraint === "all" || constraint === "z" ? point.z - current.z : 0;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = point;
    }
  }
  if (!closest) return undefined;
  return new Vector3(
    constraint === "all" || constraint === "x" ? closest.x : current.x,
    constraint === "all" || constraint === "y" ? closest.y : current.y,
    constraint === "all" || constraint === "z" ? closest.z : current.z,
  );
}
