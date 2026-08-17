import {
  BufferGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type {
  MaterialValue,
  ModelObjectSnapshot,
  Vector3Value,
} from "../document/types";
import { EditableMesh } from "../mesh/EditableMesh";
import { repairPolygonWinding } from "../mesh/repairOperations";
import { triangulate } from "../mesh/triangulate";

export interface ImportedMesh {
  readonly name: string;
  readonly mesh: EditableMesh;
  readonly material?: MaterialValue;
}

function validateExportObjects(
  objects: readonly ModelObjectSnapshot[],
  includeHidden: boolean,
): ModelObjectSnapshot[] {
  const included = objects.filter((object) => includeHidden || object.visible);
  if (!included.length)
    throw new Error("エクスポートできる表示オブジェクトがありません");
  for (const object of included)
    if (!object.mesh.faces.length)
      throw new Error(`${object.name}にはエクスポート可能な面がありません`);
  return included;
}

function createScene(
  objects: readonly ModelObjectSnapshot[],
  includeHidden: boolean,
  unitScale: number,
): Scene {
  const scene = new Scene();
  for (const object of validateExportObjects(objects, includeHidden)) {
    const geometry = new BufferGeometry();
    if (object.mesh.faceUvs?.some((face) => face.some(Boolean))) {
      const positions: number[] = [];
      const uvs: number[] = [];
      object.mesh.faces.forEach((face, faceIndex) => {
        for (let corner = 1; corner + 1 < face.length; corner += 1)
          for (const current of [0, corner, corner + 1]) {
            const vertexIndex = face[current]!;
            positions.push(
              object.mesh.positions[vertexIndex * 3]!,
              object.mesh.positions[vertexIndex * 3 + 1]!,
              object.mesh.positions[vertexIndex * 3 + 2]!,
            );
            const uv = object.mesh.faceUvs?.[faceIndex]?.[current];
            uvs.push(uv?.u ?? 0, uv?.v ?? 0);
          }
      });
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    } else {
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(object.mesh.positions, 3),
      );
      geometry.setIndex(triangulate(object.mesh));
    }
    geometry.computeVertexNormals();
    const mesh = new Mesh(
      geometry,
      new MeshStandardMaterial({
        color: object.material.color,
        roughness: object.material.roughness,
        metalness: object.material.metalness,
      }),
    );
    mesh.name = object.name;
    mesh.position.set(
      object.transform.position.x * unitScale,
      object.transform.position.y * unitScale,
      object.transform.position.z * unitScale,
    );
    mesh.rotation.set(
      object.transform.rotation.x,
      object.transform.rotation.y,
      object.transform.rotation.z,
    );
    mesh.scale.set(
      object.transform.scale.x * unitScale,
      object.transform.scale.y * unitScale,
      object.transform.scale.z * unitScale,
    );
    scene.add(mesh);
  }
  scene.updateMatrixWorld(true);
  return scene;
}

function disposeScene(scene: Scene): void {
  scene.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        if (material instanceof MeshStandardMaterial) {
          material.map?.dispose();
          material.normalMap?.dispose();
          material.roughnessMap?.dispose();
          material.metalnessMap?.dispose();
        }
        material.dispose();
      });
    }
  });
}

export async function exportGlb(
  objects: readonly ModelObjectSnapshot[],
  includeHidden = false,
): Promise<ArrayBuffer> {
  const scene = createScene(objects, includeHidden, 1);
  try {
    const meshes = scene.children.filter(
      (object): object is Mesh => object instanceof Mesh,
    );
    const included = validateExportObjects(objects, includeHidden);
    await Promise.all(
      meshes.map(async (mesh, index) => {
        const material = mesh.material as MeshStandardMaterial;
        const textures = included[index]!.material.textures;
        const load = async (source?: string, srgb = false) => {
          if (!source) return null;
          const texture = await new TextureLoader().loadAsync(source);
          if (srgb) texture.colorSpace = SRGBColorSpace;
          return texture;
        };
        material.map = await load(textures?.baseColor?.source, true);
        material.normalMap = await load(textures?.normal?.source);
        material.roughnessMap = await load(textures?.roughness?.source);
        material.metalnessMap = await load(textures?.metalness?.source);
      }),
    );
    const result = await new GLTFExporter().parseAsync(scene, { binary: true });
    if (!(result instanceof ArrayBuffer))
      throw new Error("GLBの生成結果が不正です");
    return result;
  } finally {
    disposeScene(scene);
  }
}

export function exportStl(
  objects: readonly ModelObjectSnapshot[],
  includeHidden = false,
): ArrayBuffer {
  const scene = createScene(objects, includeHidden, 1000);
  try {
    const view = new STLExporter().parse(scene, { binary: true });
    return view.buffer.slice(
      view.byteOffset,
      view.byteOffset + view.byteLength,
    ) as ArrayBuffer;
  } finally {
    disposeScene(scene);
  }
}

function geometryToEditableMesh(
  source: BufferGeometry,
  matrix: Matrix4,
  unitScale: number,
): EditableMesh {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  geometry.applyMatrix4(matrix);
  const attribute = geometry.getAttribute("position");
  const positions: Vector3Value[] = [];
  const polygons: number[][] = [];
  const polygonUvs: ({ u: number; v: number } | null)[][] = [];
  const uvAttribute = geometry.getAttribute("uv");
  const indices = new Map<string, number>();
  for (let offset = 0; offset < attribute.count; offset += 3) {
    const face: number[] = [];
    const faceUvs: ({ u: number; v: number } | null)[] = [];
    for (let cursor = 0; cursor < 3; cursor++) {
      const index = offset + cursor;
      const point = {
        x: attribute.getX(index) * unitScale,
        y: attribute.getY(index) * unitScale,
        z: attribute.getZ(index) * unitScale,
      };
      const key = `${point.x}|${point.y}|${point.z}`;
      let vertexIndex = indices.get(key);
      if (vertexIndex === undefined) {
        vertexIndex = positions.length;
        positions.push(point);
        indices.set(key, vertexIndex);
      }
      face.push(vertexIndex);
      faceUvs.push(
        uvAttribute
          ? { u: uvAttribute.getX(index), v: uvAttribute.getY(index) }
          : null,
      );
    }
    if (new Set(face).size === 3) {
      polygons.push(face);
      polygonUvs.push(faceUvs);
    }
  }
  geometry.dispose();
  if (!polygons.length) throw new Error("読み込める三角形がありません");
  const mesh = EditableMesh.fromPolygons(
    positions,
    repairPolygonWinding(positions, polygons),
  );
  if (uvAttribute)
    [...mesh.faces.values()].forEach((face, faceIndex) => {
      let halfEdgeId = face.halfEdge;
      for (const uv of polygonUvs[faceIndex] ?? []) {
        const halfEdge = mesh.halfEdges.get(halfEdgeId)!;
        if (uv) halfEdge.uv = uv;
        halfEdgeId = halfEdge.next;
      }
    });
  return mesh;
}

export async function importGlb(data: ArrayBuffer): Promise<ImportedMesh[]> {
  const gltf = await new GLTFLoader().parseAsync(data, "");
  const result: ImportedMesh[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if (object instanceof Mesh && object.geometry) {
      const sourceMaterial = Array.isArray(object.material)
        ? object.material[0]
        : object.material;
      const standard = sourceMaterial as MeshStandardMaterial;
      result.push({
        name: object.name || `GLB Mesh ${result.length + 1}`,
        mesh: geometryToEditableMesh(object.geometry, object.matrixWorld, 1),
        material: {
          color: `#${standard.color?.getHexString() ?? "9aa5b5"}`,
          shading: "standard",
          roughness: standard.roughness ?? 0.72,
          metalness: standard.metalness ?? 0.05,
        },
      });
    }
  });
  if (!result.length) throw new Error("GLBに読み込めるメッシュがありません");
  const sourceMeshes: Mesh[] = [];
  gltf.scene.traverse((object) => {
    if (object instanceof Mesh && object.geometry) sourceMeshes.push(object);
  });
  await Promise.all(
    result.map(async (item, index) => {
      const sourceMaterial = sourceMeshes[index]?.material;
      const material = (
        Array.isArray(sourceMaterial) ? sourceMaterial[0] : sourceMaterial
      ) as MeshStandardMaterial | undefined;
      if (!material || !item.material) return;
      const [baseColor, normal, roughness, metalness] = await Promise.all([
        textureValue(material.map, "srgb"),
        textureValue(material.normalMap, "linear"),
        textureValue(material.roughnessMap, "linear"),
        textureValue(material.metalnessMap, "linear"),
      ]);
      if (baseColor || normal || roughness || metalness)
        (item.material as { textures?: MaterialValue["textures"] }).textures = {
          baseColor,
          normal,
          roughness,
          metalness,
        };
    }),
  );
  return result;
}

async function textureValue(
  texture: import("three").Texture | null | undefined,
  colorSpace: "srgb" | "linear",
): Promise<import("../document/types").TextureValue | undefined> {
  if (!texture?.image || typeof document === "undefined") return undefined;
  const image = texture.image as CanvasImageSource & {
    width?: number;
    height?: number;
  };
  const width = image.width ?? 0;
  const height = image.height ?? 0;
  if (!width || !height) return undefined;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    return { source: canvas.toDataURL("image/png"), colorSpace };
  } catch {
    return undefined;
  }
}

export function importStl(
  data: ArrayBuffer,
  unitScale = 0.001,
): ImportedMesh[] {
  const geometry = new STLLoader().parse(data);
  try {
    return [
      {
        name: "STL Mesh",
        mesh: geometryToEditableMesh(geometry, new Matrix4(), unitScale),
      },
    ];
  } finally {
    geometry.dispose();
  }
}

/** Export Wavefront OBJ geometry. Materials are represented by vertex geometry only. */
export function exportObj(
  objects: readonly ModelObjectSnapshot[],
  includeHidden = false,
): string {
  const lines = ["# Polygon Modeler OBJ", "s off"];
  let vertexOffset = 1;
  let uvOffset = 1;
  for (const object of validateExportObjects(objects, includeHidden)) {
    const matrix = new Matrix4().compose(
      new Vector3(
        object.transform.position.x,
        object.transform.position.y,
        object.transform.position.z,
      ),
      new Quaternion().setFromEuler(
        new Euler(
          object.transform.rotation.x,
          object.transform.rotation.y,
          object.transform.rotation.z,
        ),
      ),
      new Vector3(
        object.transform.scale.x,
        object.transform.scale.y,
        object.transform.scale.z,
      ),
    );
    lines.push(`o ${object.name.replace(/[\r\n]/g, " ")}`);
    for (let index = 0; index < object.mesh.positions.length; index += 3) {
      const point = new Vector3(
        object.mesh.positions[index]!,
        object.mesh.positions[index + 1]!,
        object.mesh.positions[index + 2]!,
      ).applyMatrix4(matrix);
      lines.push(`v ${point.x} ${point.y} ${point.z}`);
    }
    const faceUvIndices: number[][] = [];
    for (const faceUvs of object.mesh.faceUvs ??
      object.mesh.faces.map((face) => face.map(() => null))) {
      const indices: number[] = [];
      for (const uv of faceUvs) {
        if (!uv) {
          indices.push(0);
          continue;
        }
        lines.push(`vt ${uv.u} ${uv.v}`);
        indices.push(uvOffset++);
      }
      faceUvIndices.push(indices);
    }
    object.mesh.faces.forEach((face, faceIndex) => {
      const uvIndices = faceUvIndices[faceIndex]!;
      lines.push(
        `f ${face
          .map((index, corner) => {
            const vertex = vertexOffset + index;
            const uv = uvIndices[corner];
            return uv ? `${vertex}/${uv}` : String(vertex);
          })
          .join(" ")}`,
      );
    });
    vertexOffset += object.mesh.positions.length / 3;
  }
  return `${lines.join("\n")}\n`;
}

/** Import the common polygon/UV subset of Wavefront OBJ. */
export function importObj(source: string, unitScale = 1): ImportedMesh[] {
  const positions: Vector3Value[] = [];
  const uvs: { u: number; v: number }[] = [];
  const groups: {
    name: string;
    faces: { vertices: number[]; uvs: (number | null)[] }[];
  }[] = [];
  let group = {
    name: "OBJ Mesh",
    faces: [] as { vertices: number[]; uvs: (number | null)[] }[],
  };
  groups.push(group);
  const resolveIndex = (value: string, length: number, label: string) => {
    const parsed = Number.parseInt(value, 10);
    const index = parsed < 0 ? length + parsed : parsed - 1;
    if (!Number.isInteger(parsed) || index < 0 || index >= length)
      throw new Error(`OBJの${label}インデックスが不正です: ${value}`);
    return index;
  };
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [keyword, ...values] = line.split(/\s+/);
    if (keyword === "v" && values.length >= 3) {
      const [x, y, z] = values.slice(0, 3).map(Number);
      if (![x, y, z].every(Number.isFinite))
        throw new Error("OBJの頂点が不正です");
      positions.push({ x: x!, y: y!, z: z! });
    } else if (keyword === "vt" && values.length >= 2) {
      const [u, v] = values.slice(0, 2).map(Number);
      if (![u, v].every(Number.isFinite)) throw new Error("OBJのUVが不正です");
      uvs.push({ u: u!, v: v! });
    } else if ((keyword === "o" || keyword === "g") && values.length) {
      if (group.faces.length) {
        group = { name: values.join(" "), faces: [] };
        groups.push(group);
      } else group.name = values.join(" ");
    } else if (keyword === "f") {
      if (values.length < 3) throw new Error("OBJの面には3頂点以上が必要です");
      const corners = values.map((value) => value.split("/"));
      group.faces.push({
        vertices: corners.map(([vertex]) =>
          resolveIndex(vertex!, positions.length, "頂点"),
        ),
        uvs: corners.map(([, uv]) =>
          uv ? resolveIndex(uv, uvs.length, "UV") : null,
        ),
      });
    }
  }
  const imported = groups
    .filter(({ faces }) => faces.length)
    .map(({ name, faces }) => {
      const used = [...new Set(faces.flatMap((face) => face.vertices))];
      const localIndex = new Map(used.map((index, offset) => [index, offset]));
      const localPositions = used.map((index) => {
        const point = positions[index]!;
        return {
          x: point.x * unitScale,
          y: point.y * unitScale,
          z: point.z * unitScale,
        };
      });
      const localFaces = faces.map((face) =>
        face.vertices.map((index) => localIndex.get(index)!),
      );
      let mesh: EditableMesh;
      try {
        mesh = EditableMesh.fromPolygons(localPositions, localFaces);
      } catch (error) {
        throw new Error(
          `OBJのトポロジーが不正です: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      [...mesh.faces.values()].forEach((face, faceIndex) => {
        const sourceFace = faces[faceIndex]!;
        for (let corner = 0; corner < face.vertices.length; corner++) {
          const halfEdge = [...mesh.halfEdges.values()].find(
            (candidate) =>
              candidate.face === face.id &&
              candidate.origin === face.vertices[corner],
          );
          const uvIndex = sourceFace.uvs[corner];
          if (halfEdge && uvIndex !== null) halfEdge.uv = { ...uvs[uvIndex]! };
        }
      });
      return { name, mesh };
    });
  if (!imported.length) throw new Error("OBJに読み込める面がありません");
  return imported;
}
