import type { ModelObjectSnapshot, ObjectId, TransformValue } from "./types";
import type { EditableMesh } from "../mesh/EditableMesh";
const identityTransform = (): TransformValue => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
});
export class ModelObject {
  readonly id: ObjectId;
  readonly mesh: EditableMesh;
  name: string;
  visible = true;
  transform: TransformValue = identityTransform();
  constructor(id: ObjectId, name: string, mesh: EditableMesh) {
    this.id = id;
    this.mesh = mesh;
    this.name = name;
  }
  toSnapshot(): ModelObjectSnapshot {
    return {
      id: this.id,
      name: this.name,
      visible: this.visible,
      transform: this.transform,
      mesh: this.mesh.toMeshData(),
    };
  }
}
