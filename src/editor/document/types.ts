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
export type ShadingModel = "basic" | "lambert" | "phong" | "standard";
export interface TextureValue {
  /** Embedded data URL or a project-relative URL. */
  readonly source: string;
  readonly name?: string;
  readonly colorSpace?: "srgb" | "linear";
}
export interface MaterialValue {
  readonly color: string;
  readonly shading: ShadingModel;
  readonly roughness: number;
  readonly metalness: number;
  readonly textures?: {
    readonly baseColor?: TextureValue;
    readonly normal?: TextureValue;
    readonly roughness?: TextureValue;
    readonly metalness?: TextureValue;
  };
}
export type ModifierValue =
  | {
      readonly id: string;
      readonly type: "mirror";
      readonly axis: "x" | "y" | "z";
      readonly enabled: boolean;
    }
  | {
      readonly id: string;
      readonly type: "array";
      readonly count: number;
      readonly offset: Vector3Value;
      readonly enabled: boolean;
    }
  | {
      readonly id: string;
      readonly type: "solidify";
      readonly thickness: number;
      readonly enabled: boolean;
    }
  | {
      readonly id: string;
      readonly type: "bevel";
      readonly amount: number;
      readonly enabled: boolean;
    }
  | {
      readonly id: string;
      readonly type: "subdivision";
      readonly levels: number;
      readonly enabled: boolean;
    };
export interface MeshData {
  readonly positions: readonly number[];
  readonly faces: readonly (readonly number[])[];
  readonly revision: number;
  readonly vertexIds: readonly VertexId[];
  readonly faceIds: readonly FaceId[];
  /** Per-face UVs, in the same corner order as `faces`. */
  readonly faceUvs?: readonly (readonly ({
    readonly u: number;
    readonly v: number;
  } | null)[])[];
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
  readonly material: MaterialValue;
  readonly modifiers?: readonly ModifierValue[];
  readonly mesh: MeshData;
  readonly evaluatedMesh?: MeshData;
}
export interface EditorSnapshot {
  readonly objects: readonly ModelObjectSnapshot[];
  readonly selectedObjectIds: ReadonlySet<ObjectId>;
  readonly revision: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly selectionModes: ReadonlySet<
    import("../selection/SelectionManager").SelectionMode
  >;
  readonly selectionItems: readonly import("../selection/SelectionManager").SelectionItem[];
  readonly isDirty: boolean;
}
