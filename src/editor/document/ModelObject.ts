import type {
  MaterialValue,
  ModifierValue,
  ModelObjectSnapshot,
  ObjectId,
  TransformValue,
} from "./types";
import type { EditableMesh } from "../mesh/EditableMesh";
import { evaluateModifierStack } from "../modifiers/modifierStack";
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
  modifiers: ModifierValue[] = [];
  #modifierCache?: { key: string; mesh: ModelObjectSnapshot["mesh"] };
  constructor(id: ObjectId, name: string, mesh: EditableMesh) {
    this.id = id;
    this.mesh = mesh;
    this.name = name;
  }
  toSnapshot(): ModelObjectSnapshot {
    const modifierKey = `${this.mesh.revision}:${JSON.stringify(this.modifiers)}`;
    if (this.modifiers.length && this.#modifierCache?.key !== modifierKey)
      this.#modifierCache = {
        key: modifierKey,
        mesh: evaluateModifierStack(this.mesh, this.modifiers).toMeshData(),
      };
    if (!this.modifiers.length) this.#modifierCache = undefined;
    const evaluatedMesh = this.#modifierCache?.mesh;
    return {
      id: this.id,
      name: this.name,
      visible: this.visible,
      transform: this.transform,
      material: this.material,
      modifiers: this.modifiers,
      mesh: this.mesh.toMeshData(),
      evaluatedMesh,
    };
  }
}
