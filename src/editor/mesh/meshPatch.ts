import type {
  EditableMeshArchive,
  MeshEdge,
  MeshFace,
  MeshHalfEdge,
  MeshVertex,
} from "./EditableMesh";

export interface MeshPatch {
  readonly vertices: readonly EntityPatch<MeshVertex>[];
  readonly halfEdges: readonly EntityPatch<MeshHalfEdge>[];
  readonly edges: readonly EntityPatch<MeshEdge>[];
  readonly faces: readonly EntityPatch<MeshFace>[];
  readonly nextIds: EditableMeshArchive["nextIds"];
}

export interface EntityPatch<T extends { readonly id: string }> {
  readonly id: T["id"];
  readonly value?: T;
}

export function createMeshPatch(
  source: EditableMeshArchive,
  target: EditableMeshArchive,
): MeshPatch {
  return {
    vertices: diffEntities(source.vertices, target.vertices),
    halfEdges: diffEntities(source.halfEdges, target.halfEdges),
    edges: diffEntities(source.edges, target.edges),
    faces: diffEntities(source.faces, target.faces),
    nextIds: { ...target.nextIds },
  };
}

export function meshPatchSize(patch: MeshPatch): number {
  return (
    patch.vertices.length +
    patch.halfEdges.length +
    patch.edges.length +
    patch.faces.length
  );
}

function diffEntities<T extends { readonly id: string }>(
  source: readonly T[],
  target: readonly T[],
): EntityPatch<T>[] {
  const before = new Map(source.map((entity) => [entity.id, entity]));
  const after = new Map(target.map((entity) => [entity.id, entity]));
  const result: EntityPatch<T>[] = [];
  for (const [id, entity] of before) {
    const next = after.get(id);
    if (!next) result.push({ id: entity.id });
    else if (!equalEntity(entity, next))
      result.push({ id: next.id, value: structuredClone(next) });
  }
  for (const [id, entity] of after)
    if (!before.has(id))
      result.push({ id: entity.id, value: structuredClone(entity) });
  return result;
}

const equalEntity = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);
