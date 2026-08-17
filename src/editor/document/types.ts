export type ObjectId = string & { readonly __brand: "ObjectId" };
export type VertexId = string & { readonly __brand: "VertexId" };
export type HalfEdgeId = string & { readonly __brand: "HalfEdgeId" };
export type EdgeId = string & { readonly __brand: "EdgeId" };
export type FaceId = string & { readonly __brand: "FaceId" };
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
  readonly revision: number;
  readonly vertexIds: readonly VertexId[];
  readonly faceIds: readonly FaceId[];
  readonly edges: readonly {
    readonly id: EdgeId;
    readonly vertices: readonly [number, number];
  }[];
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
  readonly selectionMode: import("../selection/SelectionManager").SelectionMode;
  readonly selectionModes: ReadonlySet<
    import("../selection/SelectionManager").SelectionMode
  >;
  readonly selectionItems: readonly import("../selection/SelectionManager").SelectionItem[];
  readonly isDirty: boolean;
}
