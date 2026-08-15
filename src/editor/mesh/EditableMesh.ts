import type {
  EdgeId,
  FaceId,
  HalfEdgeId,
  MeshData,
  Vector3Value,
  VertexId,
} from "../document/types";
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
    };
  }
  #id(prefix: string, sequence: number) {
    return `${prefix}-${sequence}`;
  }
}
