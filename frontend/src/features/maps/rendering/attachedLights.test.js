import { expect, it } from "vitest";
import { Group } from "three";
import { createAttachedLights } from "./attachedLights";
import { createObjectMotion } from "./objectMotion";
import { tileTransform } from "./tileTransform";
import { lightPose } from "../lib/mapLighting";

const model = {
  id: "floor",
  width: 2,
  height: 1,
  mountDepth: 0.1,
  surfaceHeight: 0.5,
  placementOffset: [0.1, -0.05],
  placementPoints: [{ x: 0.5, y: 0.5, elevation: 0.5 }],
};
const tile = {
  id: "tile",
  modelId: "floor",
  x: 2,
  y: 3,
  elevation: 0.6,
  rotation: 0,
};
it("objects follow the lifted, translated and rotated tile matrix without changing the document", () => {
  const object = {
    id: "chest",
    x: 2.5,
    y: 3.5,
    elevation: 1,
    rotation: 30,
    placement: { tileId: "tile", point: 0 },
  };
  const snapshot = JSON.stringify({ tile, object });
  let target = tileTransform(tile, model);
  const motion = createObjectMotion({ metadata: () => model }, () => target),
    root = new Group(),
    chest = new Group();
  chest.userData.objectId = "chest";
  root.add(chest);
  motion.update([object], { tiles: [tile] });
  motion.advance(16, root);
  expect(chest.position.toArray()).toEqual([2.5, 1, 3.5]);
  target = tileTransform(
    { ...tile, x: 5, y: 4, elevation: 1.42, rotation: 90 },
    model,
  );
  motion.advance(16, root);
  expect(chest.position.x).toBeCloseTo(5.5);
  expect(chest.position.y).toBeCloseTo(1.82);
  expect(chest.position.z).toBeCloseTo(4.5);
  expect(chest.rotation.y).toBeCloseTo((-120 * Math.PI) / 180);
  expect(JSON.stringify({ tile, object })).toBe(snapshot);
});
it("tile lights, including off-centre built-ins, follow the same preview and landing frame", () => {
  const builtin = { key: "fire", position: [0.3, 0.7, 0.8] };
  const catalogue = [{ ...model, behaviour: { defaultLights: [builtin] } }];
  const document = { tiles: [tile], objects: [], width: 10, height: 10 };
  const context = {
    placements: new Map([[tile.id, { elevation: tile.elevation }]]),
  };
  const lights = [
    {
      id: "manual",
      anchor: { kind: "tile", id: "tile" },
      offset: [0.2, 0.1],
      height: 0.9,
    },
    { id: "builtin", builtinKey: "fire", anchor: { kind: "tile", id: "tile" } },
  ].map((l) => lightPose(l, document, catalogue, context));
  const attachments = createAttachedLights();
  attachments.update(lights, [tile], [], catalogue);
  const target = { ...tile, x: 4, y: 6, rotation: 90, elevation: 1.2 };
  const targetDocument = { ...document, tiles: [target] };
  const targetContext = {
    placements: new Map([[tile.id, { elevation: 1.2 }]]),
  };
  for (const light of lights) {
    const expected = lightPose(light, targetDocument, catalogue, targetContext);
    const p = attachments.position(
      light,
      () => tileTransform(target, model),
      new Group(),
    );
    expect(p.x).toBeCloseTo(expected.x);
    expect(p.y).toBeCloseTo(expected.worldHeight);
    expect(p.z).toBeCloseTo(expected.y);
  }
});
it("lights anchored to an object follow its animated rotation, scale and lift", () => {
  const object = {
    id: "chest",
    x: 2,
    y: 3,
    elevation: 1,
    rotation: 0,
    scale: 2,
  };
  const light = {
    id: "light",
    anchor: { kind: "object", id: "chest" },
    x: 2.4,
    y: 3,
    worldHeight: 2,
  };
  const attachments = createAttachedLights();
  attachments.update([light], [], [object], []);
  const root = new Group(),
    visual = new Group();
  visual.userData.objectId = "chest";
  visual.position.set(5, 1.22, 6);
  visual.rotation.y = -Math.PI / 2;
  visual.scale.setScalar(2);
  root.add(visual);
  const p = attachments.position(light, () => null, root);
  expect(p.toArray()[0]).toBeCloseTo(5);
  expect(p.y).toBeCloseTo(2.22);
  expect(p.z).toBeCloseTo(6.4);
});
