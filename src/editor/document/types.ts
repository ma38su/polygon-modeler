export type ObjectId = string & { readonly __brand: "ObjectId" };
export interface Vector3Value {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
export interface TransformValue {
  readonly position: Vector3Value;
  readonly rotation: Vector3Value;
  readonly scale: Vector3Value;
}
export interface MeshData {
  readonly positions: readonly number[];
  readonly faces: readonly (readonly number[])[];
}
export interface ModelObjectSnapshot {
  readonly id: ObjectId;
  readonly name: string;
  readonly visible: boolean;
  readonly transform: TransformValue;
  readonly mesh: MeshData;
}
export interface EditorSnapshot {
  readonly objects: readonly ModelObjectSnapshot[];
  readonly selectedObjectIds: ReadonlySet<ObjectId>;
  readonly revision: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}
