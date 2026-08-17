import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { ModelObject } from "../document/ModelObject";
import type { ObjectId } from "../document/types";
import { createPlaneMesh } from "../mesh/primitives/plane";
import { numericElementTransformUpdates } from "./numericElementTransform";

const worldMatrix = (object: ReturnType<ModelObject["toSnapshot"]>) =>
  new Matrix4().compose(
    new Vector3(
      object.transform.position.x,
      object.transform.position.y,
      object.transform.position.z,
    ),
    new Quaternion().setFromEuler(
      new Euler(
        object.transform.rotation.x,
        object.transform.rotation.y,
        object.transform.rotation.z,
      ),
    ),
    new Vector3(
      object.transform.scale.x,
      object.transform.scale.y,
      object.transform.scale.z,
    ),
  );

describe("numeric element transform frames", () => {
  it("interprets numeric translation in the first object's local axes", () => {
    const first = new ModelObject(
      "object-1" as ObjectId,
      "First",
      createPlaneMesh(),
    );
    first.transform = {
      position: { x: 3, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: Math.PI / 2 },
      scale: { x: 2, y: 1, z: 1 },
    };
    const second = new ModelObject(
      "object-2" as ObjectId,
      "Second",
      createPlaneMesh(),
    );
    second.transform = {
      position: { x: -2, y: 0, z: 1 },
      rotation: { x: 0.2, y: 0.4, z: 0 },
      scale: { x: 0.5, y: 2, z: 1 },
    };
    const objects = [first.toSnapshot(), second.toSnapshot()];
    const items = objects.map((object) => ({
      objectId: object.id,
      elementId: object.mesh.vertexIds[0]!,
    }));
    const updates = numericElementTransformUpdates(
      objects,
      items,
      "translate",
      { x: 1, y: 0, z: 0 },
      "local",
    );
    updates.forEach((update, index) => {
      const object = objects[index]!;
      const before = new Vector3()
        .fromArray(object.mesh.positions, 0)
        .applyMatrix4(worldMatrix(object));
      const after = new Vector3(
        update.vertices[0]!.position.x,
        update.vertices[0]!.position.y,
        update.vertices[0]!.position.z,
      ).applyMatrix4(worldMatrix(object));
      const delta = after.sub(before);
      expect(delta.x).toBeCloseTo(0);
      expect(delta.y).toBeCloseTo(1);
      expect(delta.z).toBeCloseTo(0);
    });
  });

  it("scales selections from transformed objects around one world pivot", () => {
    const objects = [0, 1].map((index) => {
      const object = new ModelObject(
        `object-${index + 1}` as ObjectId,
        `Object ${index + 1}`,
        createPlaneMesh(),
      );
      object.transform = {
        position: { x: index * 4, y: index, z: 0 },
        rotation: { x: 0, y: index * 0.4, z: index * 0.2 },
        scale: { x: index + 1, y: 1, z: 1 },
      };
      return object.toSnapshot();
    });
    const items = objects.map((object) => ({
      objectId: object.id,
      elementId: object.mesh.vertexIds[0]!,
    }));
    const before = objects.map((object) =>
      new Vector3()
        .fromArray(object.mesh.positions, 0)
        .applyMatrix4(worldMatrix(object)),
    );
    const pivot = before[0]!.clone().add(before[1]!).multiplyScalar(0.5);
    const updates = numericElementTransformUpdates(
      objects,
      items,
      "scale",
      { x: 2, y: 2, z: 2 },
      "world",
    );
    updates.forEach((update, index) => {
      const after = new Vector3(
        update.vertices[0]!.position.x,
        update.vertices[0]!.position.y,
        update.vertices[0]!.position.z,
      ).applyMatrix4(worldMatrix(objects[index]!));
      expect(after.distanceTo(pivot)).toBeCloseTo(
        before[index]!.distanceTo(pivot) * 2,
      );
    });
  });
});
