import { describe, expect, it } from "vitest";
import { ModelDocument } from "../document/ModelDocument";
import { ModelObject } from "../document/ModelObject";
import type { ObjectId } from "../document/types";
import { createBoxMesh } from "../mesh/primitives/box";
import { EditMeshCommand } from "./EditMeshCommand";

describe("EditMeshCommand mesh patches", () => {
  it("retains only a changed vertex for a positional edit", () => {
    const before = createBoxMesh();
    const after = before.clone();
    const vertex = [...after.vertices.keys()][0]!;
    after.transformVertices(new Set([vertex]), (position) => ({
      ...position,
      x: position.x + 2,
    }));
    const command = new EditMeshCommand(
      "move one vertex",
      "object-1" as ObjectId,
      before,
      after,
    );
    expect(command.retainedEntityCount).toBe(2);
  });

  it("applies and reverses topology patches without retaining whole meshes", () => {
    const document = new ModelDocument();
    const id = "object-1" as ObjectId;
    const before = createBoxMesh();
    const after = before.clone();
    after.deleteFace([...after.faces.keys()][0]!);
    document.addObject(new ModelObject(id, "Box", before.clone()));
    const command = new EditMeshCommand("delete face", id, before, after);

    command.execute(document);
    expect(document.getObject(id)!.mesh.faces.size).toBe(5);
    command.undo(document);
    expect(document.getObject(id)!.mesh.faces.size).toBe(6);
    command.redo(document);
    expect(document.getObject(id)!.mesh.faces.size).toBe(5);
  });
});
