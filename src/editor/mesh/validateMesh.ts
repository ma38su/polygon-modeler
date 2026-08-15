import { EditableMesh } from "./EditableMesh";
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}
export function validateMesh(mesh: EditableMesh): ValidationResult {
  const errors: string[] = [];
  for (const vertex of mesh.vertices.values()) {
    if (
      ![vertex.position.x, vertex.position.y, vertex.position.z].every(
        Number.isFinite,
      )
    )
      errors.push(`Vertex ${vertex.id} has a non-finite position`);
    if (vertex.halfEdge && !mesh.halfEdges.has(vertex.halfEdge))
      errors.push(`Vertex ${vertex.id} references a missing half-edge`);
  }
  for (const halfEdge of mesh.halfEdges.values()) {
    if (
      !mesh.vertices.has(halfEdge.origin) ||
      !mesh.vertices.has(halfEdge.destination)
    )
      errors.push(`Half-edge ${halfEdge.id} references a missing vertex`);
    if (!mesh.halfEdges.has(halfEdge.next))
      errors.push(`Half-edge ${halfEdge.id} has a missing next link`);
    if (!mesh.faces.has(halfEdge.face))
      errors.push(`Half-edge ${halfEdge.id} references a missing face`);
    const edge = mesh.edges.get(halfEdge.edge);
    if (!edge?.halfEdges.includes(halfEdge.id))
      errors.push(`Half-edge ${halfEdge.id} disagrees with its edge`);
    if (halfEdge.twin) {
      const twin = mesh.halfEdges.get(halfEdge.twin);
      if (!twin || twin.twin !== halfEdge.id)
        errors.push(`Half-edge ${halfEdge.id} has an asymmetric twin`);
    }
  }
  for (const face of mesh.faces.values()) {
    let current = face.halfEdge;
    const visited = new Set();
    while (!visited.has(current)) {
      visited.add(current);
      const halfEdge = mesh.halfEdges.get(current);
      if (!halfEdge || halfEdge.face !== face.id) {
        errors.push(`Face ${face.id} has a broken loop`);
        break;
      }
      current = halfEdge.next;
    }
    if (current !== face.halfEdge || visited.size !== face.vertices.length)
      errors.push(`Face ${face.id} loop is not closed`);
  }
  for (const edge of mesh.edges.values())
    if (edge.halfEdges.length < 1 || edge.halfEdges.length > 2)
      errors.push(`Edge ${edge.id} has invalid incidence`);
  return { valid: errors.length === 0, errors };
}
