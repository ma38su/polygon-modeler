import type {
  EdgeId,
  FaceId,
  HalfEdgeId,
  MeshData,
  Vector3Value,
  VertexId,
} from "../document/types";
import type { EntityPatch, MeshPatch } from "./meshPatch";
export interface MeshVertex {
  readonly id: VertexId;
  position: Vector3Value;
  halfEdge?: HalfEdgeId;
}
export interface MeshHalfEdge {
  readonly id: HalfEdgeId;
  readonly origin: VertexId;
  readonly destination: VertexId;
  twin?: HalfEdgeId;
  readonly next: HalfEdgeId;
  readonly face: FaceId;
  readonly edge: EdgeId;
  uv?: { readonly u: number; readonly v: number };
}
export interface MeshEdge {
  readonly id: EdgeId;
  halfEdges: HalfEdgeId[];
}
export interface MeshFace {
  readonly id: FaceId;
  readonly halfEdge: HalfEdgeId;
  readonly vertices: readonly VertexId[];
}
export interface EditableMeshArchive {
  readonly vertices: readonly MeshVertex[];
  readonly halfEdges: readonly MeshHalfEdge[];
  readonly edges: readonly MeshEdge[];
  readonly faces: readonly MeshFace[];
  readonly nextIds: {
    readonly vertex: number;
    readonly halfEdge: number;
    readonly edge: number;
    readonly face: number;
  };
  readonly revision: number;
}

export class EditableMesh {
  readonly vertices = new Map<VertexId, MeshVertex>();
  readonly halfEdges = new Map<HalfEdgeId, MeshHalfEdge>();
  readonly edges = new Map<EdgeId, MeshEdge>();
  readonly faces = new Map<FaceId, MeshFace>();
  #nextVertex = 1;
  #nextHalfEdge = 1;
  #nextEdge = 1;
  #nextFace = 1;
  #revision = 0;
  get revision() {
    return this.#revision;
  }
  clone(): EditableMesh {
    const copy = new EditableMesh();
    for (const [id, vertex] of this.vertices)
      copy.vertices.set(id, { ...vertex, position: { ...vertex.position } });
    for (const [id, halfEdge] of this.halfEdges)
      copy.halfEdges.set(id, {
        ...halfEdge,
        uv: halfEdge.uv ? { ...halfEdge.uv } : undefined,
      });
    for (const [id, edge] of this.edges)
      copy.edges.set(id, { ...edge, halfEdges: [...edge.halfEdges] });
    for (const [id, face] of this.faces)
      copy.faces.set(id, { ...face, vertices: [...face.vertices] });
    copy.#nextVertex = this.#nextVertex;
    copy.#nextHalfEdge = this.#nextHalfEdge;
    copy.#nextEdge = this.#nextEdge;
    copy.#nextFace = this.#nextFace;
    copy.#revision = this.#revision;
    return copy;
  }
  toArchive(): EditableMeshArchive {
    return {
      vertices: [...this.vertices.values()].map((vertex) => ({
        ...vertex,
        position: { ...vertex.position },
      })),
      halfEdges: [...this.halfEdges.values()].map((halfEdge) => ({
        ...halfEdge,
        uv: halfEdge.uv ? { ...halfEdge.uv } : undefined,
      })),
      edges: [...this.edges.values()].map((edge) => ({
        ...edge,
        halfEdges: [...edge.halfEdges],
      })),
      faces: [...this.faces.values()].map((face) => ({
        ...face,
        vertices: [...face.vertices],
      })),
      nextIds: {
        vertex: this.#nextVertex,
        halfEdge: this.#nextHalfEdge,
        edge: this.#nextEdge,
        face: this.#nextFace,
      },
      revision: this.#revision,
    };
  }
  static fromArchive(archive: EditableMeshArchive): EditableMesh {
    const mesh = new EditableMesh();
    for (const vertex of archive.vertices)
      mesh.vertices.set(vertex.id, {
        ...vertex,
        position: { ...vertex.position },
      });
    for (const halfEdge of archive.halfEdges)
      mesh.halfEdges.set(halfEdge.id, {
        ...halfEdge,
        uv: halfEdge.uv ? { ...halfEdge.uv } : undefined,
      });
    for (const edge of archive.edges)
      mesh.edges.set(edge.id, { ...edge, halfEdges: [...edge.halfEdges] });
    for (const face of archive.faces)
      mesh.faces.set(face.id, { ...face, vertices: [...face.vertices] });
    mesh.#nextVertex = archive.nextIds.vertex;
    mesh.#nextHalfEdge = archive.nextIds.halfEdge;
    mesh.#nextEdge = archive.nextIds.edge;
    mesh.#nextFace = archive.nextIds.face;
    mesh.#revision = archive.revision;
    return mesh;
  }
  replaceWith(source: EditableMesh): void {
    this.vertices.clear();
    this.halfEdges.clear();
    this.edges.clear();
    this.faces.clear();
    for (const [id, vertex] of source.vertices)
      this.vertices.set(id, {
        ...vertex,
        position: { ...vertex.position },
      });
    for (const [id, halfEdge] of source.halfEdges)
      this.halfEdges.set(id, {
        ...halfEdge,
        uv: halfEdge.uv ? { ...halfEdge.uv } : undefined,
      });
    for (const [id, edge] of source.edges)
      this.edges.set(id, { ...edge, halfEdges: [...edge.halfEdges] });
    for (const [id, face] of source.faces)
      this.faces.set(id, { ...face, vertices: [...face.vertices] });
    this.#nextVertex = source.#nextVertex;
    this.#nextHalfEdge = source.#nextHalfEdge;
    this.#nextEdge = source.#nextEdge;
    this.#nextFace = source.#nextFace;
    this.#revision = source.#revision + 1;
  }
  applyPatch(patch: MeshPatch): void {
    applyEntityPatch(this.vertices, patch.vertices, cloneVertex);
    applyEntityPatch(this.halfEdges, patch.halfEdges, (value) => ({
      ...value,
      uv: value.uv ? { ...value.uv } : undefined,
    }));
    applyEntityPatch(this.edges, patch.edges, (value) => ({
      ...value,
      halfEdges: [...value.halfEdges],
    }));
    applyEntityPatch(this.faces, patch.faces, (value) => ({
      ...value,
      vertices: [...value.vertices],
    }));
    this.#nextVertex = patch.nextIds.vertex;
    this.#nextHalfEdge = patch.nextIds.halfEdge;
    this.#nextEdge = patch.nextIds.edge;
    this.#nextFace = patch.nextIds.face;
    this.#revision += 1;
  }
  transformVertices(
    ids: ReadonlySet<VertexId>,
    transform: (position: Vector3Value) => Vector3Value,
  ): void {
    for (const id of ids) {
      const vertex = this.vertices.get(id);
      if (vertex) vertex.position = transform(vertex.position);
    }
    this.#revision += 1;
  }
  setVertexPositions(positions: ReadonlyMap<VertexId, Vector3Value>): void {
    let changed = false;
    for (const [id, position] of positions) {
      const vertex = this.vertices.get(id);
      if (!vertex) continue;
      vertex.position = { ...position };
      changed = true;
    }
    if (changed) this.#revision += 1;
  }
  deleteEdge(id: EdgeId): void {
    const edge = this.edges.get(id);
    if (!edge) return;
    const faces = new Set(
      edge.halfEdges.map((halfEdgeId) => this.halfEdges.get(halfEdgeId)!.face),
    );
    for (const face of faces) this.deleteFace(face);
  }
  deleteVertex(id: VertexId): void {
    const faces = new Set(
      [...this.halfEdges.values()]
        .filter(
          (halfEdge) => halfEdge.origin === id || halfEdge.destination === id,
        )
        .map((halfEdge) => halfEdge.face),
    );
    for (const face of faces) this.deleteFace(face);
    this.vertices.delete(id);
    this.#revision += 1;
  }

  static fromPolygons(
    positions: readonly Vector3Value[],
    polygons: readonly (readonly number[])[],
  ): EditableMesh {
    const mesh = new EditableMesh();
    const vertexIds = positions.map((position) => {
      const id = mesh.#id("v", mesh.#nextVertex++) as VertexId;
      mesh.vertices.set(id, { id, position: { ...position } });
      return id;
    });
    const directed = new Map<string, HalfEdgeId>();
    for (const polygon of polygons) {
      if (polygon.length < 3)
        throw new Error("A face requires at least three vertices");
      const ids = polygon.map((index) => {
        const id = vertexIds[index];
        if (!id) throw new Error(`Vertex index out of range: ${index}`);
        return id;
      });
      if (new Set(ids).size !== ids.length)
        throw new Error("A face cannot repeat a vertex");
      const faceId = mesh.#id("f", mesh.#nextFace++) as FaceId;
      const halfEdgeIds = ids.map(
        () => mesh.#id("h", mesh.#nextHalfEdge++) as HalfEdgeId,
      );
      ids.forEach((origin, index) => {
        const destination = ids[(index + 1) % ids.length]!;
        const halfEdgeId = halfEdgeIds[index]!;
        const reverseKey = `${destination}|${origin}`;
        if (directed.has(`${origin}|${destination}`)) {
          throw new Error("Non-manifold edge or inconsistent face winding");
        }
        const twinId = directed.get(reverseKey);
        let edgeId: EdgeId;
        if (twinId) {
          const twin = mesh.halfEdges.get(twinId)!;
          const edge = mesh.edges.get(twin.edge)!;
          if (edge.halfEdges.length >= 2) throw new Error("Non-manifold edge");
          edgeId = edge.id;
          edge.halfEdges.push(halfEdgeId);
          twin.twin = halfEdgeId;
        } else {
          edgeId = mesh.#id("e", mesh.#nextEdge++) as EdgeId;
          mesh.edges.set(edgeId, { id: edgeId, halfEdges: [halfEdgeId] });
        }
        mesh.halfEdges.set(halfEdgeId, {
          id: halfEdgeId,
          origin,
          destination,
          twin: twinId,
          next: halfEdgeIds[(index + 1) % ids.length]!,
          face: faceId,
          edge: edgeId,
        });
        mesh.vertices.get(origin)!.halfEdge ??= halfEdgeId;
        directed.set(`${origin}|${destination}`, halfEdgeId);
      });
      mesh.faces.set(faceId, {
        id: faceId,
        halfEdge: halfEdgeIds[0]!,
        vertices: ids,
      });
    }
    mesh.#revision += 1;
    return mesh;
  }

  deleteFace(id: FaceId): void {
    const face = this.faces.get(id);
    if (!face) return;
    const removed = new Set<HalfEdgeId>();
    let current = face.halfEdge;
    do {
      removed.add(current);
      const halfEdge = this.halfEdges.get(current)!;
      const edge = this.edges.get(halfEdge.edge)!;
      edge.halfEdges = edge.halfEdges.filter(
        (candidate) => candidate !== current,
      );
      if (edge.halfEdges.length === 0) this.edges.delete(edge.id);
      else {
        const survivor = this.halfEdges.get(edge.halfEdges[0]!)!;
        survivor.twin = undefined;
      }
      current = halfEdge.next;
    } while (current !== face.halfEdge);
    for (const halfEdgeId of removed) this.halfEdges.delete(halfEdgeId);
    this.faces.delete(id);
    for (const vertex of this.vertices.values())
      if (vertex.halfEdge && removed.has(vertex.halfEdge))
        vertex.halfEdge = [...this.halfEdges.values()].find(
          (halfEdge) => halfEdge.origin === vertex.id,
        )?.id;
    this.#revision += 1;
  }

  toMeshData(): MeshData {
    const vertices = [...this.vertices.values()];
    const indexById = new Map(
      vertices.map((vertex, index) => [vertex.id, index]),
    );
    const uvByCorner = new Map<string, MeshHalfEdge["uv"]>();
    for (const halfEdge of this.halfEdges.values())
      if (halfEdge.uv)
        uvByCorner.set(`${halfEdge.face}|${halfEdge.origin}`, halfEdge.uv);
    const faceUvs = uvByCorner.size
      ? [...this.faces.values()].map((face) =>
          face.vertices.map((vertexId) => {
            const uv = uvByCorner.get(`${face.id}|${vertexId}`);
            return uv ? { ...uv } : null;
          }),
        )
      : undefined;
    return {
      positions: vertices.flatMap((vertex) => [
        vertex.position.x,
        vertex.position.y,
        vertex.position.z,
      ]),
      faces: [...this.faces.values()].map((face) =>
        face.vertices.map((id) => indexById.get(id)!),
      ),
      revision: this.#revision,
      vertexIds: vertices.map((vertex) => vertex.id),
      faceIds: [...this.faces.keys()],
      faceUvs,
      edges: [...this.edges.values()].map((edge) => {
        const halfEdge = this.halfEdges.get(edge.halfEdges[0]!)!;
        return {
          id: edge.id,
          vertices: [
            indexById.get(halfEdge.origin)!,
            indexById.get(halfEdge.destination)!,
          ],
        };
      }),
    };
  }
  #id(prefix: string, sequence: number) {
    return `${prefix}-${sequence}`;
  }
}

function applyEntityPatch<T extends { readonly id: string }>(
  target: Map<T["id"], T>,
  patch: readonly EntityPatch<T>[],
  clone: (value: T) => T,
): void {
  for (const change of patch) {
    if (change.value) target.set(change.id, clone(change.value));
    else target.delete(change.id);
  }
}

const cloneVertex = (value: MeshVertex): MeshVertex => ({
  ...value,
  position: { ...value.position },
});
