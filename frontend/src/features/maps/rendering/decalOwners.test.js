import { expect, it, vi } from "vitest";
import { Group } from "three";
import { createDecalOwners } from "./decalOwners";

it("projects onto the actual detail tier while an object is being moved", () => {
  const assets = { visual: vi.fn(() => ({ parts: [] })) };
  const runtime = {
    tier: "lod",
    options: {},
    placedTiles: [],
    posedObjects: [{ id: "object", modelId: "model" }],
    appearance: { hiddenObjects: new Set() },
  };
  const objects = new Group(),
    objectPreview = { root: new Group() };
  const node = new Group();
  node.userData.objectId = "object";
  objectPreview.root.add(node);
  const owners = createDecalOwners(
    assets,
    runtime,
    {},
    {},
    objects,
    objectPreview,
  );
  owners.update();
  owners.get("object", "object");
  expect(assets.visual).toHaveBeenLastCalledWith("model", "render");
  runtime.options.forceLod = true;
  owners.get("object", "object");
  expect(assets.visual).toHaveBeenLastCalledWith("model", "lod");
});
