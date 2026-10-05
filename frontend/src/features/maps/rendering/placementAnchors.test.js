import { expect, it } from "vitest";
import { Raycaster, Vector3 } from "three";
import { createPlacementAnchors } from "./placementAnchors";
import { structureContext } from "../lib/tileStructure";
it("marks free sockets, nearby cells and the proposed target separately and can disable picking", () => {
  const document = {
      width: 5,
      height: 5,
      kind: "tiles",
      tiles: [
        { id: "base", modelId: "frame", x: 2, y: 2, level: 0, rotation: 0 },
      ],
    },
    models = [
      {
        id: "frame",
        width: 1,
        height: 1,
        supportSlots: [{ x: 0, y: 0, width: 1, height: 1, elevation: 0.6 }],
      },
      { id: "floor", width: 1, height: 1 },
    ],
    context = structureContext(document, models),
    anchors = createPlacementAnchors();
  anchors.update(document, context, {
    showAnchors: true,
    previewTile: { modelId: "floor", x: 2, y: 2, level: 1, rotation: 0 },
  });
  const hit = anchors.hit(
    new Raycaster(new Vector3(2.5, 10, 2.5), new Vector3(0, -1, 0)),
  );
  expect(hit.anchor).toMatchObject({ level: 1, elevation: 0.6 });
  expect(
    anchors.root.children.some((m) => m.material.color.getHex() === 0xb399e5),
  ).toBe(true);
  expect(
    anchors.root.children.some((m) => m.material.color.getHex() === 0x73c99a),
  ).toBe(true);
  anchors.update(document, context, { showAnchors: false });
  expect(
    anchors.hit(
      new Raycaster(new Vector3(2.5, 10, 2.5), new Vector3(0, -1, 0)),
    ),
  ).toBeNull();
  anchors.destroy();
});
