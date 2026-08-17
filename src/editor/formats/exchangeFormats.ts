import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Scene,
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
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(object.mesh.positions, 3),
    );
    geometry.setIndex(triangulate(object.mesh));
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
      if (Array.isArray(object.material))
        object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    }
  });
}

export async function exportGlb(
  objects: readonly ModelObjectSnapshot[],
  includeHidden = false,
): Promise<ArrayBuffer> {
  const scene = createScene(objects, includeHidden, 1);
  try {
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
  const indices = new Map<string, number>();
  for (let offset = 0; offset < attribute.count; offset += 3) {
    const face: number[] = [];
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
    }
    if (new Set(face).size === 3) polygons.push(face);
  }
  geometry.dispose();
  if (!polygons.length) throw new Error("読み込める三角形がありません");
  return EditableMesh.fromPolygons(positions, polygons);
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
  return result;
}

export function importStl(data: ArrayBuffer): ImportedMesh[] {
  const geometry = new STLLoader().parse(data);
  try {
    return [
      {
        name: "STL Mesh",
        mesh: geometryToEditableMesh(geometry, new Matrix4(), 0.001),
      },
    ];
  } finally {
    geometry.dispose();
  }
}
