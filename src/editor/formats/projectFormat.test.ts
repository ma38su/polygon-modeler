import { describe, expect, it } from "vitest";
import { ModelObject } from "../document/ModelObject";
import type { ObjectId } from "../document/types";
import { createBoxMesh } from "../mesh/primitives/box";
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
    };
    const restored = deserializeProject(serializeProject([original]))[0]!;
    expect(restored.toSnapshot()).toEqual(original.toSnapshot());
    expect(restored.mesh.toArchive()).toEqual(original.mesh.toArchive());
  });

  it("rejects corrupt JSON and unsupported versions", () => {
    expect(() => deserializeProject("{")).toThrow("有効なJSONではありません");
    expect(() =>
      deserializeProject(
        JSON.stringify({ formatVersion: PROJECT_FORMAT_VERSION + 1 }),
      ),
    ).toThrow("未対応のformatVersion");
  });
});
