import { defaultMaterial, ModelObject } from "../document/ModelObject";
import type { MaterialValue, ModifierValue } from "../document/types";
import type { HalfEdgeId, ObjectId, VertexId } from "../document/types";
import { EditableMesh, type EditableMeshArchive } from "../mesh/EditableMesh";
import { validateMesh } from "../mesh/validateMesh";

export const PROJECT_FORMAT_VERSION = 2;
export const PROJECT_EXTENSION = ".polyproj";

interface ProjectMeshRecord extends Omit<EditableMeshArchive, "vertices"> {
  readonly vertexIds: readonly VertexId[];
  readonly vertexHalfEdges: readonly (HalfEdgeId | null)[];
  readonly positionsBase64: string;
}

interface ProjectRecord {
  readonly formatVersion: number;
  readonly metadata: {
    readonly savedAt: string;
    readonly unit: "meter";
    readonly encoding: "float64-base64";
  };
  readonly objects: readonly {
    readonly id: ObjectId;
    readonly name: string;
    readonly visible: boolean;
    readonly transform: ModelObject["transform"];
    readonly material?: MaterialValue;
    readonly modifiers?: readonly ModifierValue[];
    readonly mesh: ProjectMeshRecord;
  }[];
}

const alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const a = bytes[offset]!;
    const b = bytes[offset + 1];
    const c = bytes[offset + 2];
    const value = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    result += alphabet[(value >> 18) & 63];
    result += alphabet[(value >> 12) & 63];
    result += b === undefined ? "=" : alphabet[(value >> 6) & 63];
    result += c === undefined ? "=" : alphabet[value & 63];
  }
  return result;
}

function decodeBase64(value: string): Uint8Array {
  if (value.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(value))
    throw new Error("メッシュのバイナリデータが不正です");
  const bytes: number[] = [];
  for (let offset = 0; offset < value.length; offset += 4) {
    const chunk = value.slice(offset, offset + 4);
    const indices = [...chunk].map((character) =>
      character === "=" ? 0 : alphabet.indexOf(character),
    );
    const combined =
      (indices[0]! << 18) |
      (indices[1]! << 12) |
      (indices[2]! << 6) |
      indices[3]!;
    bytes.push((combined >> 16) & 255);
    if (chunk[2] !== "=") bytes.push((combined >> 8) & 255);
    if (chunk[3] !== "=") bytes.push(combined & 255);
  }
  return new Uint8Array(bytes);
}

function encodePositions(archive: EditableMeshArchive): string {
  const values = new Float64Array(
    archive.vertices.flatMap((vertex) => [
      vertex.position.x,
      vertex.position.y,
      vertex.position.z,
    ]),
  );
  return encodeBase64(new Uint8Array(values.buffer));
}

function decodePositions(value: string, count: number): Float64Array {
  const bytes = decodeBase64(value);
  if (bytes.byteLength !== count * 3 * Float64Array.BYTES_PER_ELEMENT)
    throw new Error("頂点数とバイナリデータの長さが一致しません");
  const aligned = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  return new Float64Array(aligned);
}

export function serializeProject(objects: readonly ModelObject[]): string {
  const record: ProjectRecord = {
    formatVersion: PROJECT_FORMAT_VERSION,
    metadata: {
      savedAt: new Date().toISOString(),
      unit: "meter",
      encoding: "float64-base64",
    },
    objects: objects.map((object) => {
      const archive = object.mesh.toArchive();
      return {
        id: object.id,
        name: object.name,
        visible: object.visible,
        transform: object.transform,
        material: object.material,
        modifiers: object.modifiers,
        mesh: {
          halfEdges: archive.halfEdges,
          edges: archive.edges,
          faces: archive.faces,
          nextIds: archive.nextIds,
          revision: archive.revision,
          vertexIds: archive.vertices.map((vertex) => vertex.id),
          vertexHalfEdges: archive.vertices.map(
            (vertex) => vertex.halfEdge ?? null,
          ),
          positionsBase64: encodePositions(archive),
        },
      };
    }),
  };
  return JSON.stringify(record);
}

export function deserializeProject(source: string): ModelObject[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("プロジェクトファイルは有効なJSONではありません");
  }
  if (!parsed || typeof parsed !== "object")
    throw new Error("プロジェクトデータが不正です");
  const record = parsed as Partial<ProjectRecord>;
  if (
    record.formatVersion !== 1 &&
    record.formatVersion !== PROJECT_FORMAT_VERSION
  )
    throw new Error(
      `未対応のformatVersionです: ${String(record.formatVersion)}`,
    );
  if (!Array.isArray(record.objects))
    throw new Error("オブジェクト一覧がありません");
  return record.objects.map((item) => {
    if (!item || typeof item !== "object" || !item.mesh)
      throw new Error("オブジェクトデータが不正です");
    const meshRecord = item.mesh;
    if (
      !Array.isArray(meshRecord.vertexIds) ||
      !Array.isArray(meshRecord.vertexHalfEdges) ||
      typeof meshRecord.positionsBase64 !== "string" ||
      !Array.isArray(meshRecord.halfEdges) ||
      !Array.isArray(meshRecord.edges) ||
      !Array.isArray(meshRecord.faces)
    )
      throw new Error("メッシュデータが不正です");
    const positions = decodePositions(
      meshRecord.positionsBase64,
      meshRecord.vertexIds.length,
    );
    const archive: EditableMeshArchive = {
      vertices: meshRecord.vertexIds.map((id: VertexId, index: number) => ({
        id,
        position: {
          x: positions[index * 3]!,
          y: positions[index * 3 + 1]!,
          z: positions[index * 3 + 2]!,
        },
        halfEdge: meshRecord.vertexHalfEdges[index] ?? undefined,
      })),
      halfEdges: meshRecord.halfEdges,
      edges: meshRecord.edges,
      faces: meshRecord.faces,
      nextIds: meshRecord.nextIds,
      revision: meshRecord.revision,
    };
    const mesh = EditableMesh.fromArchive(archive);
    const validation = validateMesh(mesh);
    if (!validation.valid)
      throw new Error(`メッシュが破損しています: ${validation.errors[0]}`);
    const object = new ModelObject(item.id, item.name, mesh);
    object.visible = item.visible;
    object.transform = item.transform;
    object.material = item.material ?? defaultMaterial();
    object.modifiers = item.modifiers ? structuredClone(item.modifiers) : [];
    return object;
  });
}
