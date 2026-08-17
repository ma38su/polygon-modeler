import { ModelDocument } from "./document/ModelDocument";
import { ModelObject } from "./document/ModelObject";
import type {
  EdgeId,
  EditorSnapshot,
  FaceId,
  ModelObjectSnapshot,
  ObjectId,
  VertexId,
  Vector3Value,
} from "./document/types";
import { createBoxMesh } from "./mesh/primitives/box";
import { createPlaneMesh } from "./mesh/primitives/plane";
import { createCylinderMesh } from "./mesh/primitives/cylinder";
import type { EditableMesh } from "./mesh/EditableMesh";
import { validateMesh } from "./mesh/validateMesh";
import { CommandHistory } from "./history/CommandHistory";
import {
  CreateObjectCommand,
  DeleteObjectCommand,
  TransformObjectCommand,
} from "./commands/objectCommands";
import type { TransformValue } from "./document/types";
import {
  SelectionManager,
  type SelectionItem,
  type SelectionMode,
} from "./selection/SelectionManager";
import { EditMeshCommand } from "./commands/EditMeshCommand";
import { CompositeCommand } from "./commands/CompositeCommand";
import type { EditorCommand } from "./commands/EditorCommand";
import type { SelectionSnapshot } from "./selection/SelectionManager";
import {
  changeSelectionByAdjacency,
  selectEdgeLoop as collectSelectedEdgeLoop,
  selectEdgeRing as collectSelectedEdgeRing,
  type AdjacencySelectionOperation,
} from "./selection/topologySelection";
import {
  createFace,
  bevelElements,
  extrudeFaces,
  insetFaces,
  flipFaces,
  mergeVertices,
  loopCut,
  knifeFace,
  splitEdge,
  splitFace,
} from "./mesh/topologyOperations";
import { deserializeProject, serializeProject } from "./formats/projectFormat";
import type { ImportedMesh } from "./formats/exchangeFormats";
import {
  extractFaces,
  joinObjectMeshes,
  mirrorMesh,
} from "./mesh/objectOperations";
import { moveElementsAlongNormals } from "./mesh/normalMovement";
import {
  mergeByDistance,
  recalculateFaceNormals,
} from "./mesh/repairOperations";
import {
  evaluateBoolean,
  type BooleanOperation,
} from "./boolean/booleanOperations";
type Listener = () => void;
export class Editor {
  readonly document = new ModelDocument();
  readonly #listeners = new Set<Listener>();
  readonly #selectedObjectIds = new Set<ObjectId>();
  readonly history = new CommandHistory();
  readonly selection = new SelectionManager();
  readonly #selectionHistory = new WeakMap<
    EditorCommand,
    { before: SelectionSnapshot; after: SelectionSnapshot }
  >();
  #nextObjectId = 1;
  #revision = 0;
  #isDirty = false;
  #snapshot: EditorSnapshot = this.#createSnapshot();
  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  getSnapshot = (): EditorSnapshot => this.#snapshot;
  createBox(): ObjectId {
    return this.#createObject("Box", createBoxMesh());
  }
  createPlane(): ObjectId {
    return this.#createObject("Plane", createPlaneMesh());
  }
  createCylinder(): ObjectId {
    return this.#createObject("Cylinder", createCylinderMesh());
  }
  importMeshes(items: readonly ImportedMesh[]): ObjectId[] {
    if (!items.length) return [];
    const objects = items.map((item) => {
      const validation = validateMesh(item.mesh);
      if (!validation.valid) throw new Error(validation.errors.join("\n"));
      const sequence = this.#nextObjectId++;
      return new ModelObject(
        `object-${sequence}` as ObjectId,
        item.name || `Imported ${sequence}`,
        item.mesh,
      );
    });
    this.history.execute(
      new CompositeCommand(
        "メッシュを読み込む",
        objects.map((object) => new CreateObjectCommand(object)),
      ),
      this.document,
    );
    this.selection.clear();
    this.#selectedObjectIds.clear();
    objects.forEach((object) => this.#selectedObjectIds.add(object.id));
    this.#commit(true);
    return objects.map((object) => object.id);
  }
  #createObject(kind: string, mesh: EditableMesh): ObjectId {
    const validation = validateMesh(mesh);
    if (!validation.valid) throw new Error(validation.errors.join("\n"));
    const sequence = this.#nextObjectId++;
    const id = `object-${sequence}` as ObjectId;
    const object = new ModelObject(id, `${kind} ${sequence}`, mesh);
    this.history.execute(new CreateObjectCommand(object), this.document);
    this.#selectedObjectIds.clear();
    this.#selectedObjectIds.add(id);
    this.selection.clear();
    this.#commit(true);
    return id;
  }
  deleteSelectedObjects(): void {
    if (this.#selectedObjectIds.size === 0) return;
    this.history.execute(
      new DeleteObjectCommand([...this.#selectedObjectIds]),
      this.document,
    );
    this.#selectedObjectIds.clear();
    this.selection.clear();
    this.#commit(true);
  }
  selectObject(id?: ObjectId, additive = false): void {
    if (id && !this.document.getObject(id)) return;
    if (!additive) this.#selectedObjectIds.clear();
    if (id && additive && this.#selectedObjectIds.has(id))
      this.#selectedObjectIds.delete(id);
    else if (id) this.#selectedObjectIds.add(id);
    this.selection.clear();
    this.#commit();
  }
  duplicateSelectedObjects(): void {
    const sources = this.document
      .objects()
      .filter((object) => this.#selectedObjectIds.has(object.id));
    if (!sources.length) return;
    const copies = sources.map((source) => {
      const sequence = this.#nextObjectId++;
      const copy = new ModelObject(
        `object-${sequence}` as ObjectId,
        `${source.name} Copy`,
        source.mesh.clone(),
      );
      copy.transform = structuredClone(source.transform);
      copy.visible = source.visible;
      return copy;
    });
    this.history.execute(
      new CompositeCommand(
        "オブジェクトを複製",
        copies.map((copy) => new CreateObjectCommand(copy)),
      ),
      this.document,
    );
    this.#selectedObjectIds.clear();
    copies.forEach((copy) => this.#selectedObjectIds.add(copy.id));
    this.#commit(true);
  }
  mirrorSelectedObjects(axis: "x" | "y" | "z"): void {
    const sources = this.document
      .objects()
      .filter((object) => this.#selectedObjectIds.has(object.id));
    if (!sources.length) return;
    const copies = sources.map((source) => {
      const sequence = this.#nextObjectId++;
      const copy = new ModelObject(
        `object-${sequence}` as ObjectId,
        `${source.name} Mirror ${axis.toUpperCase()}`,
        mirrorMesh(source.mesh, axis),
      );
      copy.transform = structuredClone(source.transform);
      copy.visible = source.visible;
      return copy;
    });
    this.history.execute(
      new CompositeCommand(
        `オブジェクトを${axis.toUpperCase()}ミラー`,
        copies.map((copy) => new CreateObjectCommand(copy)),
      ),
      this.document,
    );
    this.#selectedObjectIds.clear();
    copies.forEach((copy) => this.#selectedObjectIds.add(copy.id));
    this.#commit(true);
  }
  joinSelectedObjects(): void {
    const sources = this.document
      .objects()
      .filter((object) => this.#selectedObjectIds.has(object.id));
    if (sources.length < 2) return;
    const sequence = this.#nextObjectId++;
    const joined = new ModelObject(
      `object-${sequence}` as ObjectId,
      `Joined ${sequence}`,
      joinObjectMeshes(sources.map((object) => object.toSnapshot())),
    );
    this.history.execute(
      new CompositeCommand("オブジェクトを結合", [
        new DeleteObjectCommand(sources.map((source) => source.id)),
        new CreateObjectCommand(joined),
      ]),
      this.document,
    );
    this.#selectedObjectIds.clear();
    this.#selectedObjectIds.add(joined.id);
    this.#commit(true);
  }
  mergeSelectedObjectsByDistance(distance: number): void {
    this.#repairSelectedObjects("距離で頂点を結合", (mesh) =>
      mergeByDistance(mesh, distance),
    );
  }
  recalculateSelectedObjectNormals(): void {
    this.#repairSelectedObjects("面法線を再計算", recalculateFaceNormals);
  }
  #repairSelectedObjects(
    label: string,
    repair: (mesh: EditableMesh) => EditableMesh,
  ): void {
    const commands = this.document
      .objects()
      .filter((object) => this.#selectedObjectIds.has(object.id))
      .map(
        (object) =>
          new EditMeshCommand(
            label,
            object.id,
            object.mesh,
            repair(object.mesh),
          ),
      );
    if (!commands.length) return;
    this.history.execute(new CompositeCommand(label, commands), this.document);
    this.selection.clear();
    this.#commit(true);
  }
  async booleanSelectedObjects(operation: BooleanOperation): Promise<void> {
    const sources = this.document
      .objects()
      .filter((object) => this.#selectedObjectIds.has(object.id));
    if (sources.length !== 2)
      throw new Error("Boolean演算には2つのオブジェクトを選択してください");
    const sourceIds = sources.map((source) => source.id);
    const sourceRevision = this.#revision;
    const resultMesh = await evaluateBoolean(
      sources[0]!.toSnapshot(),
      sources[1]!.toSnapshot(),
      operation,
    );
    if (
      sourceRevision !== this.#revision ||
      sourceIds.some((id) => !this.document.getObject(id))
    )
      throw new Error("演算中に対象オブジェクトが変更されました");
    const sequence = this.#nextObjectId++;
    const labels = {
      union: "Union",
      subtract: "Subtract",
      intersect: "Intersect",
    };
    const result = new ModelObject(
      `object-${sequence}` as ObjectId,
      `${labels[operation]} ${sequence}`,
      resultMesh,
    );
    this.history.execute(
      new CompositeCommand(`Boolean ${labels[operation]}`, [
        new DeleteObjectCommand(sourceIds),
        new CreateObjectCommand(result),
      ]),
      this.document,
    );
    this.selection.clear();
    this.#selectedObjectIds.clear();
    this.#selectedObjectIds.add(result.id);
    this.#commit(true);
  }
  separateSelectedFaces(): void {
    const commands: EditorCommand[] = [];
    const created: ModelObject[] = [];
    for (const [objectId, items] of this.#selectionGroups()) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const faces = new Set(
        items
          .map((item) => item.elementId as FaceId)
          .filter((id) => object.mesh.faces.has(id)),
      );
      if (!faces.size || faces.size === object.mesh.faces.size) continue;
      const remaining = extractFaces(object.mesh, faces, false);
      const separated = new ModelObject(
        `object-${this.#nextObjectId++}` as ObjectId,
        `${object.name} Separated`,
        extractFaces(object.mesh, faces, true),
      );
      separated.transform = structuredClone(object.transform);
      commands.push(
        new EditMeshCommand("面を分離", objectId, object.mesh, remaining),
        new CreateObjectCommand(separated),
      );
      created.push(separated);
    }
    if (!commands.length) return;
    this.history.execute(
      new CompositeCommand("面を分離", commands),
      this.document,
    );
    this.selection.clear();
    this.#selectedObjectIds.clear();
    created.forEach((object) => this.#selectedObjectIds.add(object.id));
    this.#commit(true);
  }
  setSelectionMode(mode: SelectionMode): void {
    if (!this.selection.setMode(mode)) return;
    this.#selectedObjectIds.clear();
    this.#commit();
  }
  toggleSelectionMode(mode: SelectionMode): void {
    this.selection.toggleMode(mode);
    this.#selectedObjectIds.clear();
    this.#commit();
  }
  selectElement(item?: SelectionItem, additive = false): void {
    if (additive && item) this.selection.toggle(item);
    else this.selection.replace(item);
    this.#selectedObjectIds.clear();
    for (const selected of this.selection.items)
      this.#selectedObjectIds.add(selected.objectId);
    this.#commit();
  }
  selectElements(items: readonly SelectionItem[], additive = false): void {
    if (additive) this.selection.addAll(items);
    else this.selection.selectAll(items);
    this.#selectedObjectIds.clear();
    for (const selected of this.selection.items)
      this.#selectedObjectIds.add(selected.objectId);
    this.#commit();
  }
  clearSelection(): void {
    this.selection.clear();
    this.#selectedObjectIds.clear();
    this.#commit();
  }
  selectAll(): void {
    const items: SelectionItem[] = [];
    for (const object of this.document.toSnapshot()) {
      if (this.selection.modes.has("vertex"))
        object.mesh.vertexIds.forEach((id) =>
          items.push({ objectId: object.id, elementId: id }),
        );
      if (this.selection.modes.has("edge"))
        object.mesh.edges.forEach((edge) =>
          items.push({ objectId: object.id, elementId: edge.id }),
        );
      if (this.selection.modes.has("face"))
        object.mesh.faceIds.forEach((id) =>
          items.push({ objectId: object.id, elementId: id }),
        );
    }
    this.selection.selectAll(items);
    this.#selectedObjectIds.clear();
    for (const item of items) this.#selectedObjectIds.add(item.objectId);
    this.#commit();
  }
  growSelection(): void {
    this.#changeSelectionByAdjacency("grow");
  }
  shrinkSelection(): void {
    this.#changeSelectionByAdjacency("shrink");
  }
  selectConnected(): void {
    this.#changeSelectionByAdjacency("connected");
  }
  selectEdgeLoop(): void {
    this.#selectEdgePath(collectSelectedEdgeLoop);
  }
  selectEdgeRing(): void {
    this.#selectEdgePath(collectSelectedEdgeRing);
  }
  #selectEdgePath(
    collect: (mesh: EditableMesh, selected: ReadonlySet<EdgeId>) => EdgeId[],
  ): void {
    const result = [...this.selection.items];
    for (const objectId of new Set(result.map((item) => item.objectId))) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const selected = new Set(
        result
          .filter(
            (item) =>
              item.objectId === objectId &&
              object.mesh.edges.has(item.elementId as EdgeId),
          )
          .map((item) => item.elementId as EdgeId),
      );
      result.push(
        ...collect(object.mesh, selected).map((elementId) => ({
          objectId,
          elementId,
        })),
      );
    }
    this.selectElements(result);
  }
  setObjectVisible(id: ObjectId, visible: boolean): void {
    const object = this.document.getObject(id);
    if (!object || object.visible === visible) return;
    object.visible = visible;
    this.#commit(true);
  }
  transformObject(id: ObjectId, transform: TransformValue): void {
    const object = this.document.getObject(id);
    if (!object) return;
    this.history.execute(
      new TransformObjectCommand(id, object.transform, transform),
      this.document,
    );
    this.#commit(true);
  }
  translateSelected(delta: Vector3Value): void {
    this.#translateSelected(() => delta);
  }
  previewTranslateSelected(
    delta: Vector3Value,
  ): readonly ModelObjectSnapshot[] {
    return this.#previewSelectedTransform((position) => ({
      x: position.x + delta.x,
      y: position.y + delta.y,
      z: position.z + delta.z,
    }));
  }
  translateSelectedInWorld(delta: Vector3Value): void {
    this.#translateSelected((objectId) => {
      const object = this.document.getObject(objectId);
      if (!object) return delta;
      const { rotation, scale } = object.transform;
      const [cx, sx, cy, sy, cz, sz] = [
        Math.cos(rotation.x),
        Math.sin(rotation.x),
        Math.cos(rotation.y),
        Math.sin(rotation.y),
        Math.cos(rotation.z),
        Math.sin(rotation.z),
      ];
      let { x, y, z } = delta;
      [x, y] = [x * cz + y * sz, -x * sz + y * cz];
      [x, z] = [x * cy - z * sy, x * sy + z * cy];
      [y, z] = [y * cx + z * sx, -y * sx + z * cx];
      return {
        x: x / scale.x,
        y: y / scale.y,
        z: z / scale.z,
      };
    });
  }
  applyElementTransform(
    label: string,
    updates: readonly {
      objectId: ObjectId;
      vertices: readonly { id: VertexId; position: Vector3Value }[];
    }[],
  ): void {
    const commands: EditMeshCommand[] = [];
    for (const update of updates) {
      const object = this.document.getObject(update.objectId);
      if (!object || update.vertices.length === 0) continue;
      const selected = this.#selectedVertices(update.objectId);
      const positions = new Map(
        update.vertices
          .filter((vertex) => selected.has(vertex.id))
          .map((vertex) => [vertex.id, vertex.position] as const),
      );
      if (positions.size === 0) continue;
      const after = object.mesh.clone();
      after.setVertexPositions(positions);
      commands.push(
        new EditMeshCommand(label, update.objectId, object.mesh, after),
      );
    }
    if (commands.length) {
      this.history.execute(
        new CompositeCommand(label, commands),
        this.document,
      );
      this.#commit(true);
    }
  }
  #translateSelected(
    deltaForObject: (objectId: ObjectId) => Vector3Value,
  ): void {
    const commands: EditMeshCommand[] = [];
    for (const objectId of new Set(
      this.selection.items.map((item) => item.objectId),
    )) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const delta = deltaForObject(objectId);
      const ids = this.#selectedVertices(objectId);
      const after = object.mesh.clone();
      after.transformVertices(ids, (position) => ({
        x: position.x + delta.x,
        y: position.y + delta.y,
        z: position.z + delta.z,
      }));
      commands.push(
        new EditMeshCommand("要素を移動", objectId, object.mesh, after),
      );
    }
    if (commands.length) {
      this.history.execute(
        new CompositeCommand("要素を移動", commands),
        this.document,
      );
      this.#commit(true);
    }
  }
  scaleSelected(scale: Vector3Value): void {
    const pivot = this.#selectionPivot();
    this.#transformSelected("要素を拡大縮小", (position) => ({
      x: pivot.x + (position.x - pivot.x) * scale.x,
      y: pivot.y + (position.y - pivot.y) * scale.y,
      z: pivot.z + (position.z - pivot.z) * scale.z,
    }));
  }
  previewScaleSelected(scale: Vector3Value): readonly ModelObjectSnapshot[] {
    const pivot = this.#selectionPivot();
    return this.#previewSelectedTransform((position) => ({
      x: pivot.x + (position.x - pivot.x) * scale.x,
      y: pivot.y + (position.y - pivot.y) * scale.y,
      z: pivot.z + (position.z - pivot.z) * scale.z,
    }));
  }
  rotateSelected(rotation: Vector3Value): void {
    const pivot = this.#selectionPivot();
    const [cx, sx, cy, sy, cz, sz] = [
      Math.cos(rotation.x),
      Math.sin(rotation.x),
      Math.cos(rotation.y),
      Math.sin(rotation.y),
      Math.cos(rotation.z),
      Math.sin(rotation.z),
    ];
    this.#transformSelected("要素を回転", (position) => {
      let x = position.x - pivot.x;
      let y = position.y - pivot.y;
      let z = position.z - pivot.z;
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      return { x: x + pivot.x, y: y + pivot.y, z: z + pivot.z };
    });
  }
  previewRotateSelected(
    rotation: Vector3Value,
  ): readonly ModelObjectSnapshot[] {
    const pivot = this.#selectionPivot();
    const [cx, sx, cy, sy, cz, sz] = [
      Math.cos(rotation.x),
      Math.sin(rotation.x),
      Math.cos(rotation.y),
      Math.sin(rotation.y),
      Math.cos(rotation.z),
      Math.sin(rotation.z),
    ];
    return this.#previewSelectedTransform((position) => {
      let x = position.x - pivot.x;
      let y = position.y - pivot.y;
      let z = position.z - pivot.z;
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      return { x: x + pivot.x, y: y + pivot.y, z: z + pivot.z };
    });
  }
  deleteSelectedElements(): void {
    if (this.selection.items.length === 0) {
      this.deleteSelectedObjects();
      return;
    }
    const commands: EditMeshCommand[] = [];
    for (const objectId of new Set(
      this.selection.items.map((item) => item.objectId),
    )) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const after = object.mesh.clone();
      const items = this.selection.items.filter(
        (candidate) => candidate.objectId === objectId,
      );
      items
        .filter((item) => object.mesh.faces.has(item.elementId as FaceId))
        .forEach((item) => after.deleteFace(item.elementId as FaceId));
      items
        .filter((item) => object.mesh.edges.has(item.elementId as EdgeId))
        .forEach((item) => after.deleteEdge(item.elementId as EdgeId));
      items
        .filter((item) => object.mesh.vertices.has(item.elementId as VertexId))
        .forEach((item) => after.deleteVertex(item.elementId as VertexId));
      commands.push(
        new EditMeshCommand("要素を削除", objectId, object.mesh, after),
      );
    }
    if (commands.length) {
      const command = new CompositeCommand("要素を削除", commands);
      const before = this.selection.snapshot();
      this.history.execute(command, this.document);
      this.selection.clear();
      this.#selectedObjectIds.clear();
      this.#selectionHistory.set(command, {
        before,
        after: this.selection.snapshot(),
      });
      this.#commit(true);
    }
  }
  extrudeSelectedFaces(distance: number): void {
    this.#applyTopology(
      "面を押し出し",
      (mesh, items) =>
        extrudeFaces(
          mesh,
          new Set(
            items
              .map((item) => item.elementId as FaceId)
              .filter((id) => mesh.faces.has(id)),
          ),
          distance,
        ),
      selectExtrudeResult,
    );
  }
  previewExtrudeSelectedFaces(
    distance: number,
  ): readonly ModelObjectSnapshot[] {
    if (!Number.isFinite(distance)) throw new Error("押し出し量が不正です。");
    return this.#previewTopology((mesh, items) =>
      extrudeFaces(
        mesh,
        new Set(
          items
            .map((item) => item.elementId as FaceId)
            .filter((id) => mesh.faces.has(id)),
        ),
        distance,
      ),
    );
  }
  insetSelectedFaces(amount: number): void {
    this.#applyTopology("面をインセット", (mesh, items) =>
      insetFaces(
        mesh,
        new Set(
          items
            .map((item) => item.elementId as FaceId)
            .filter((id) => mesh.faces.has(id)),
        ),
        amount,
      ),
    );
  }
  previewInsetSelectedFaces(amount: number): readonly ModelObjectSnapshot[] {
    return this.#previewTopology((mesh, items) =>
      insetFaces(
        mesh,
        new Set(
          items
            .map((item) => item.elementId as FaceId)
            .filter((id) => mesh.faces.has(id)),
        ),
        amount,
      ),
    );
  }
  bevelSelectedElements(amount: number): void {
    this.#applyTopology(
      "要素をベベル",
      (mesh, items) =>
        bevelElements(
          mesh,
          new Set(
            items
              .map((item) => item.elementId as VertexId)
              .filter((id) => mesh.vertices.has(id)),
          ),
          new Set(
            items
              .map((item) => item.elementId as EdgeId)
              .filter((id) => mesh.edges.has(id)),
          ),
          amount,
        ),
      selectCreatedFacesAndEdges,
    );
  }
  previewBevelSelectedElements(amount: number): readonly ModelObjectSnapshot[] {
    return this.#previewTopology((mesh, items) =>
      bevelElements(
        mesh,
        new Set(
          items
            .map((item) => item.elementId as VertexId)
            .filter((id) => mesh.vertices.has(id)),
        ),
        new Set(
          items
            .map((item) => item.elementId as EdgeId)
            .filter((id) => mesh.edges.has(id)),
        ),
        amount,
      ),
    );
  }
  splitSelectedElements(): void {
    this.#applyTopology("要素を分割", (mesh, items) => {
      const face = items.find((item) =>
        mesh.faces.has(item.elementId as FaceId),
      );
      if (face) return splitFace(mesh, face.elementId as FaceId);
      const edge = items.find((item) =>
        mesh.edges.has(item.elementId as EdgeId),
      );
      return edge ? splitEdge(mesh, edge.elementId as EdgeId) : mesh.clone();
    });
  }
  knifeSelectedFace(factor = 0.5): void {
    this.#applyTopology("Knife", (mesh, items) => {
      const face = items.find((item) =>
        mesh.faces.has(item.elementId as FaceId),
      );
      return face
        ? knifeFace(mesh, face.elementId as FaceId, factor)
        : mesh.clone();
    });
  }
  previewKnifeSelectedFace(factor = 0.5): readonly ModelObjectSnapshot[] {
    return this.#previewTopology((mesh, items) => {
      const face = items.find((item) =>
        mesh.faces.has(item.elementId as FaceId),
      );
      return face
        ? knifeFace(mesh, face.elementId as FaceId, factor)
        : mesh.clone();
    });
  }
  loopCutSelectedEdges(factor = 0.5): void {
    this.#applyTopology(
      "ループカット",
      (mesh, items) =>
        loopCut(
          mesh,
          new Set(
            items
              .map((item) => item.elementId as EdgeId)
              .filter((id) => mesh.edges.has(id)),
          ),
          factor,
        ),
      selectCreatedEdges,
    );
  }
  previewLoopCutSelectedEdges(factor = 0.5): readonly ModelObjectSnapshot[] {
    return this.#previewTopology((mesh, items) =>
      loopCut(
        mesh,
        new Set(
          items
            .map((item) => item.elementId as EdgeId)
            .filter((id) => mesh.edges.has(id)),
        ),
        factor,
      ),
    );
  }
  moveSelectedAlongNormals(distance: number): void {
    this.#applySelectionMesh("法線方向へ移動", (mesh, items) =>
      moveElementsAlongNormals(
        mesh,
        new Set(
          items
            .map((item) => item.elementId as FaceId)
            .filter((id) => mesh.faces.has(id)),
        ),
        new Set(
          items
            .map((item) => item.elementId as EdgeId)
            .filter((id) => mesh.edges.has(id)),
        ),
        distance,
      ),
    );
  }
  previewMoveSelectedAlongNormals(
    distance: number,
  ): readonly ModelObjectSnapshot[] {
    return this.#previewTopology((mesh, items) =>
      moveElementsAlongNormals(
        mesh,
        new Set(
          items
            .map((item) => item.elementId as FaceId)
            .filter((id) => mesh.faces.has(id)),
        ),
        new Set(
          items
            .map((item) => item.elementId as EdgeId)
            .filter((id) => mesh.edges.has(id)),
        ),
        distance,
      ),
    );
  }
  flipSelectedFaces(): void {
    this.#applyTopology("面を反転", (mesh, items) =>
      flipFaces(
        mesh,
        new Set(
          items
            .map((item) => item.elementId as FaceId)
            .filter((id) => mesh.faces.has(id)),
        ),
      ),
    );
  }
  mergeSelectedVertices(): void {
    this.#applyTopology("頂点を結合", (mesh, items) => {
      const vertices = items.filter((item) =>
        mesh.vertices.has(item.elementId as VertexId),
      );
      return vertices.length >= 2
        ? mergeVertices(
            mesh,
            vertices[0]!.elementId as VertexId,
            vertices[1]!.elementId as VertexId,
          )
        : mesh.clone();
    });
  }
  createFaceFromSelection(): void {
    this.#applyTopology("面を生成", (mesh, items) =>
      createFace(
        mesh,
        items
          .map((item) => item.elementId as VertexId)
          .filter((id) => mesh.vertices.has(id)),
      ),
    );
  }
  #applyTopology(
    label: string,
    operation: (
      mesh: EditableMesh,
      items: readonly SelectionItem[],
    ) => EditableMesh,
    selectAfter?: (
      before: EditableMesh,
      after: EditableMesh,
    ) => readonly (VertexId | EdgeId | FaceId)[],
  ): void {
    const commands: EditMeshCommand[] = [];
    const nextSelection: SelectionItem[] = [];
    for (const [objectId, items] of this.#selectionGroups()) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const after = operation(object.mesh, items);
      const validation = validateMesh(after);
      if (!validation.valid) throw new Error(validation.errors.join("\n"));
      commands.push(new EditMeshCommand(label, objectId, object.mesh, after));
      nextSelection.push(
        ...(selectAfter?.(object.mesh, after) ?? []).map((elementId) => ({
          objectId,
          elementId,
        })),
      );
    }
    if (!commands.length) return;
    const command = new CompositeCommand(label, commands);
    const before = this.selection.snapshot();
    this.history.execute(command, this.document);
    this.selection.selectAll(nextSelection);
    this.#selectedObjectIds.clear();
    nextSelection.forEach((item) => this.#selectedObjectIds.add(item.objectId));
    this.#selectionHistory.set(command, {
      before,
      after: this.selection.snapshot(),
    });
    this.#commit(true);
  }
  #applySelectionMesh(
    label: string,
    operation: (
      mesh: EditableMesh,
      items: readonly SelectionItem[],
    ) => EditableMesh,
  ): void {
    const commands: EditMeshCommand[] = [];
    for (const [objectId, items] of this.#selectionGroups()) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const after = operation(object.mesh, items);
      const validation = validateMesh(after);
      if (!validation.valid) throw new Error(validation.errors.join("\n"));
      commands.push(new EditMeshCommand(label, objectId, object.mesh, after));
    }
    if (!commands.length) return;
    this.history.execute(new CompositeCommand(label, commands), this.document);
    this.#commit(true);
  }
  #previewTopology(
    operation: (
      mesh: EditableMesh,
      items: readonly SelectionItem[],
    ) => EditableMesh,
  ): readonly ModelObjectSnapshot[] {
    const previews = new Map<ObjectId, EditableMesh>();
    for (const [objectId, items] of this.#selectionGroups()) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const after = operation(object.mesh, items);
      const validation = validateMesh(after);
      if (!validation.valid) throw new Error(validation.errors.join("\n"));
      previews.set(objectId, after);
    }
    return this.document.toSnapshot().map((object) => {
      const mesh = previews.get(object.id);
      return mesh ? { ...object, mesh: mesh.toMeshData() } : object;
    });
  }
  #changeSelectionByAdjacency(operation: AdjacencySelectionOperation): void {
    const result: SelectionItem[] = [];
    for (const object of this.document.objects()) {
      const current = this.selection.items.filter(
        (item) => item.objectId === object.id,
      );
      if (!current.length) continue;
      result.push(
        ...changeSelectionByAdjacency(
          object.mesh,
          current.map((item) => item.elementId),
          operation,
        ).map((elementId) => ({
          objectId: object.id,
          elementId,
        })),
      );
    }
    this.selectElements(result);
  }
  #selectionGroups(): Map<ObjectId, SelectionItem[]> {
    const groups = new Map<ObjectId, SelectionItem[]>();
    for (const item of this.selection.items) {
      const values = groups.get(item.objectId) ?? [];
      values.push(item);
      groups.set(item.objectId, values);
    }
    return groups;
  }
  #previewSelectedTransform(
    transform: (position: Vector3Value) => Vector3Value,
  ): readonly ModelObjectSnapshot[] {
    const previews = new Map<ObjectId, EditableMesh>();
    for (const objectId of new Set(
      this.selection.items.map((item) => item.objectId),
    )) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const mesh = object.mesh.clone();
      mesh.transformVertices(this.#selectedVertices(objectId), transform);
      previews.set(objectId, mesh);
    }
    return this.document.toSnapshot().map((object) => {
      const mesh = previews.get(object.id);
      return mesh ? { ...object, mesh: mesh.toMeshData() } : object;
    });
  }
  #transformSelected(
    label: string,
    transform: (position: Vector3Value) => Vector3Value,
  ): void {
    const commands: EditMeshCommand[] = [];
    for (const objectId of new Set(
      this.selection.items.map((item) => item.objectId),
    )) {
      const object = this.document.getObject(objectId);
      if (!object) continue;
      const after = object.mesh.clone();
      after.transformVertices(this.#selectedVertices(objectId), transform);
      commands.push(new EditMeshCommand(label, objectId, object.mesh, after));
    }
    if (commands.length) {
      this.history.execute(
        new CompositeCommand(label, commands),
        this.document,
      );
      this.#commit(true);
    }
  }
  #selectionPivot(): Vector3Value {
    const points = [];
    for (const objectId of new Set(
      this.selection.items.map((item) => item.objectId),
    )) {
      const object = this.document.getObject(objectId);
      if (object)
        for (const id of this.#selectedVertices(objectId))
          points.push(object.mesh.vertices.get(id)!.position);
    }
    if (!points.length) return { x: 0, y: 0, z: 0 };
    return points.reduce(
      (sum, point) => ({
        x: sum.x + point.x / points.length,
        y: sum.y + point.y / points.length,
        z: sum.z + point.z / points.length,
      }),
      { x: 0, y: 0, z: 0 },
    );
  }
  #selectedVertices(objectId: ObjectId): Set<VertexId> {
    const result = new Set<VertexId>();
    const object = this.document.getObject(objectId);
    if (!object) return result;
    for (const item of this.selection.items.filter(
      (candidate) => candidate.objectId === objectId,
    )) {
      if (object.mesh.vertices.has(item.elementId as VertexId))
        result.add(item.elementId as VertexId);
      else if (object.mesh.edges.has(item.elementId as EdgeId)) {
        const edge = object.mesh.edges.get(item.elementId as EdgeId);
        if (edge)
          for (const halfEdgeId of edge.halfEdges) {
            const halfEdge = object.mesh.halfEdges.get(halfEdgeId)!;
            result.add(halfEdge.origin);
            result.add(halfEdge.destination);
          }
      } else if (object.mesh.faces.has(item.elementId as FaceId)) {
        const face = object.mesh.faces.get(item.elementId as FaceId);
        if (face) for (const id of face.vertices) result.add(id);
      }
    }
    return result;
  }
  undo(): void {
    if (!this.history.canUndo) return;
    const command = this.history.undo(this.document);
    const selection = command ? this.#selectionHistory.get(command) : undefined;
    if (selection) this.#restoreSelection(selection.before);
    this.#reconcileSelection();
    this.#commit(true);
  }
  redo(): void {
    if (!this.history.canRedo) return;
    const command = this.history.redo(this.document);
    const selection = command ? this.#selectionHistory.get(command) : undefined;
    if (selection) this.#restoreSelection(selection.after);
    this.#reconcileSelection();
    this.#commit(true);
  }
  #reconcileSelection(): void {
    for (const id of this.#selectedObjectIds)
      if (!this.document.getObject(id)) this.#selectedObjectIds.delete(id);
  }
  #restoreSelection(snapshot: SelectionSnapshot): void {
    this.selection.restore(snapshot);
    this.#selectedObjectIds.clear();
    for (const item of snapshot.items)
      this.#selectedObjectIds.add(item.objectId);
  }
  serializeProject(): string {
    return serializeProject(this.document.objects());
  }
  loadProject(source: string): void {
    const objects = deserializeProject(source);
    this.document.clear();
    for (const object of objects) this.document.addObject(object);
    this.history.clear();
    this.selection.clear();
    this.#selectedObjectIds.clear();
    this.#nextObjectId =
      Math.max(
        0,
        ...objects.map((object) => {
          const match = /^object-(\d+)$/.exec(object.id);
          return match ? Number(match[1]) : 0;
        }),
      ) + 1;
    this.#isDirty = false;
    this.#commit();
  }
  markSaved(): void {
    if (!this.#isDirty) return;
    this.#isDirty = false;
    this.#commit();
  }
  #commit(documentChanged = false): void {
    if (documentChanged) this.#isDirty = true;
    this.#revision += 1;
    this.#snapshot = this.#createSnapshot();
    for (const listener of this.#listeners) listener();
  }
  #createSnapshot(): EditorSnapshot {
    return {
      objects: this.document.toSnapshot(),
      selectedObjectIds: new Set(this.#selectedObjectIds),
      revision: this.#revision,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      selectionModes: this.selection.modes,
      selectionItems: this.selection.items,
      isDirty: this.#isDirty,
    };
  }
}

function selectCreatedEdges(
  before: EditableMesh,
  after: EditableMesh,
): EdgeId[] {
  const firstCreatedVertex = before.vertices.size;
  const data = after.toMeshData();
  return data.edges.flatMap((edge) =>
    edge.vertices.every((index) => index >= firstCreatedVertex)
      ? [edge.id]
      : [],
  );
}

function selectCreatedFacesAndEdges(
  before: EditableMesh,
  after: EditableMesh,
): (FaceId | EdgeId)[] {
  const firstCreatedVertex = before.vertices.size;
  const data = after.toMeshData();
  return [
    ...data.faceIds.flatMap((id, index) =>
      data.faces[index]!.every((vertex) => vertex >= firstCreatedVertex)
        ? [id]
        : [],
    ),
    ...selectCreatedEdges(before, after),
  ];
}

const selectExtrudeResult = selectCreatedFacesAndEdges;
