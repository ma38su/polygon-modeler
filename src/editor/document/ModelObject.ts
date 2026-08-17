import type {
  MaterialValue,
  ModelObjectSnapshot,
  ObjectId,
  TransformValue,
} from "./types";
import type { EditableMesh } from "../mesh/EditableMesh";
const identityTransform = (): TransformValue => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
});
export const defaultMaterial = (): MaterialValue => ({
  color: "#9aa5b5",
  shading: "standard",
  roughness: 0.72,
  metalness: 0.05,
});
export class ModelObject {
  readonly id: ObjectId;
  readonly mesh: EditableMesh;
  name: string;
  visible = true;
  transform: TransformValue = identityTransform();
  material: MaterialValue = defaultMaterial();
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
      material: this.material,
      mesh: this.mesh.toMeshData(),
    };
  }
}
