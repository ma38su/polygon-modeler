import { describe, expect, it } from "vitest";
import { ModelObject } from "../document/ModelObject";
import type { ObjectId } from "../document/types";
import { createBoxMesh } from "../mesh/primitives/box";
import { createPlaneMesh } from "../mesh/primitives/plane";
import {
  deserializeProject,
  PROJECT_FORMAT_VERSION,
  serializeProject,
} from "./projectFormat";

describe("project format", () => {
  it("round-trips models, transforms, topology IDs, and visibility", () => {
    const original = new ModelObject(
      "object-7" as ObjectId,
      "保存テスト",
      createBoxMesh(),
    );
    original.visible = false;
    original.transform = {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.1, y: 0.2, z: 0.3 },
      scale: { x: 2, y: 3, z: 4 },
    };
    original.material = {
      color: "#336699",
      shading: "phong",
      roughness: 0.25,
      metalness: 0.75,
      textures: {
        baseColor: {
          source: "data:image/png;base64,AA==",
          name: "albedo.png",
          colorSpace: "srgb",
        },
      },
    };
    original.mesh.halfEdges.values().next().value!.uv = { u: 0.25, v: 0.75 };
    const restored = deserializeProject(serializeProject([original]))[0]!;
    expect(restored.toSnapshot()).toEqual(original.toSnapshot());
    expect(restored.mesh.toArchive()).toEqual(original.mesh.toArchive());
  });

  it("loads version 1 projects without texture or UV fields", () => {
    const object = new ModelObject(
      "object-1" as ObjectId,
      "Legacy",
      createBoxMesh(),
    );
    const serialized = JSON.parse(serializeProject([object])) as {
      formatVersion: number;
    };
    serialized.formatVersion = 1;
    const restored = deserializeProject(JSON.stringify(serialized))[0]!;
    expect(restored.name).toBe("Legacy");
    expect(restored.material.textures).toBeUndefined();
  });

  it("rejects corrupt JSON and unsupported versions", () => {
    expect(() => deserializeProject("{")).toThrow("有効なJSONではありません");
    expect(() =>
      deserializeProject(
        JSON.stringify({ formatVersion: PROJECT_FORMAT_VERSION + 1 }),
      ),
    ).toThrow("未対応のformatVersion");
  });
  it("preserves modifier stacks in version 2 projects", () => {
    const object = new ModelObject(
      "object-1" as ObjectId,
      "Plane",
      createPlaneMesh(),
    );
    object.modifiers = [
      {
        id: "array",
        type: "array",
        count: 3,
        offset: { x: 2, y: 0, z: 0 },
        enabled: true,
      },
    ];
    const restored = deserializeProject(serializeProject([object]))[0]!;
    expect(restored.modifiers).toEqual(object.modifiers);
    expect(restored.toSnapshot().evaluatedMesh!.faces).toHaveLength(3);
  });
});
