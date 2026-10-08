import { it, expect } from "vitest";
import { newMap, clone } from "./mapModel";
import { transitionDocument } from "./modelTransitions";
import { syncLights, lightPose } from "./mapLighting";
const flame = {
  key: "flame",
  name: "Факел",
  kind: "torch",
  color: "#ffc36a",
  position: [0.5, 0.75, 1.1],
  intensity: 8,
  radius: 4.5,
  enabled: true,
  flicker: true,
};
const edge = { id: "edge", toDefinitionId: "off", action: "extinguish" },
  back = { id: "back", toDefinitionId: "on", action: "ignite" };
const source = {
  id: "on-v1",
  definitionId: "on",
  collection: "ud",
  sourceCode: "37",
  sourceName: "Torch",
  width: 1,
  height: 1,
  mountDepth: 0.2,
  surfaceHeight: 0.4,
  maxHeight: 1.5,
  tileType: "wall-straight",
  version: 1,
  behaviour: { defaultLights: [flame], transitions: [edge] },
};
const target = {
  ...source,
  id: "off-v1",
  definitionId: "off",
  sourceCode: "38",
  sourceName: "Unlit",
  behaviour: { defaultLights: [], transitions: [back] },
};
function setup() {
  const d = newMap().document;
  d.tiles = [
    { id: "tile", modelId: source.id, x: 2, y: 3, rotation: 90, level: 0 },
  ];
  return { d, models: [clone(source), clone(target)] };
}
it("replaces an immutable model version, removes all its lights and preserves instance identity and areas", () => {
  const { d, models } = setup();
  d.areas = [{ id: "room", tileIds: ["tile"], objectIds: [] }];
  syncLights(d, models);
  d.lights[0].enabled = false;
  d.lights.push(
    { id: "attached", anchor: { kind: "tile", id: "tile" }, offset: [0, 0] },
    { id: "unrelated", x: 5, y: 5 },
  );
  const revision = target;
  const result = transitionDocument(d, models, "tile", "tile", edge);
  expect(result.valid).toBe(true);
  expect(result.document.tiles[0]).toEqual({
    ...d.tiles[0],
    modelId: "off-v1",
  });
  expect(result.document.areas).toEqual(d.areas);
  expect(result.document.lights.map((l) => l.id)).toEqual(["unrelated"]);
  expect(d.tiles[0].modelId).toBe("on-v1");
  expect(d.lights).toHaveLength(3);
  const reverse = transitionDocument(
    result.document,
    models,
    "tile",
    "tile",
    back,
  );
  expect(reverse.valid).toBe(true);
  expect(reverse.document.lights.find((l) => l.builtinKey)).toMatchObject({
    enabled: true,
    anchor: { kind: "tile", id: "tile" },
  });
  expect(reverse.document.lights.some((l) => l.id === "attached")).toBe(false);
});
it("repositions attached objects to distinct target points and rejects a target without room", () => {
  const { d, models } = setup();
  Object.assign(models[0], {
    canStand: true,
    placementPoints: [{ x: 0.25, y: 0.25, elevation: 0.8 }],
  });
  Object.assign(models[1], {
    canStand: true,
    placementPoints: [{ x: 0.5, y: 0.5, elevation: 0.6 }],
  });
  models.push({ id: "chest", tileType: "object" });
  d.objects = [
    {
      id: "obj",
      modelId: "chest",
      placement: { tileId: "tile", point: 0 },
      x: 2.75,
      y: 3.25,
    },
  ];
  const result = transitionDocument(d, models, "tile", "tile", edge);
  expect(result.valid).toBe(true);
  expect(result.document.objects[0]).toMatchObject({
    id: "obj",
    x: 2.5,
    y: 3.5,
  });
  expect(result.document.objects[0].elevation).toBeCloseTo(0.4);
  models[1].placementPoints = [];
  expect(transitionDocument(d, models, "tile", "tile", edge)).toMatchObject({
    valid: false,
    reason: expect.stringContaining("нет точек"),
  });
});
it("rejects removal of sockets below dependent tiles and cross-kind targets without changing the document", () => {
  const { d, models } = setup();
  models[0].supportSlots = [{ x: 0, y: 0, width: 1, height: 1, elevation: 1 }];
  d.tiles.push({
    id: "upper",
    modelId: target.id,
    x: 2,
    y: 3,
    rotation: 0,
    level: 1,
  });
  expect(transitionDocument(d, models, "tile", "tile", edge).valid).toBe(false);
  d.tiles.pop();
  models[1].tileType = "object";
  expect(transitionDocument(d, models, "tile", "tile", edge).valid).toBe(false);
  expect(d.tiles[0].modelId).toBe(source.id);
});
it("keeps independent builtin enabled states and poses through rotation, upper sockets and copying", () => {
  const { d, models } = setup();
  models.push({
    id: "frame",
    width: 1,
    height: 1,
    mountDepth: 0.1,
    supportSlots: [{ x: 0, y: 0, width: 1, height: 1, elevation: 1.1 }],
  });
  d.tiles[0].level = 1;
  d.tiles.unshift({
    id: "frame-tile",
    modelId: "frame",
    x: 2,
    y: 3,
    rotation: 0,
    level: 0,
  });
  syncLights(d, models);
  const light = d.lights[0],
    pose = lightPose(light, d, models);
  expect(pose.x).toBeCloseTo(2.25);
  expect(pose.y).toBeCloseTo(3.5);
  expect(pose.worldHeight).toBeCloseTo(2.1);
  light.enabled = false;
  d.tiles.push({ ...d.tiles[1], id: "copy", x: 4, level: 0 });
  syncLights(d, models);
  expect(d.lights).toHaveLength(2);
  expect(d.lights[0]).toMatchObject({ id: light.id, enabled: false });
  expect(d.lights[1].enabled).toBe(true);
  expect(d.lights[0].id).not.toBe(d.lights[1].id);
  models[0].behaviour.defaultLights = [];
  syncLights(d, models);
  expect(d.lights).toEqual([]);
});
it("places embedded object lights at the rotated, scaled location rather than on top of its bounding box", () => {
  const { d, models } = setup();
  const objectModel = {
    ...source,
    id: "object",
    tileType: "object",
    behaviour: { defaultLights: [{ ...flame, position: [0.75, 0.5, 0.7] }] },
  };
  models.push(objectModel);
  d.objects = [
    {
      id: "object-1",
      modelId: "object",
      x: 5,
      y: 5,
      elevation: 0.8,
      rotation: 90,
      scale: 2,
    },
  ];
  syncLights(d, models);
  const l = d.lights.find((l) => l.anchor.kind === "object"),
    p = lightPose(l, d, models);
  expect(p.x).toBeCloseTo(5);
  expect(p.y).toBeCloseTo(5.5);
  expect(p.worldHeight).toBeCloseTo(2.2);
});
it("replaces object models without losing their surface placement, rotation or scale", () => {
  const { d, models } = setup();
  const edge = { id: "empty", action: "empty", toDefinitionId: "empty-chest" };
  const object = {
    ...source,
    id: "full-chest",
    tileType: "object",
    behaviour: { transitions: [edge], defaultLights: [flame] },
  };
  models.push(object, {
    ...object,
    id: "empty-chest-version",
    definitionId: "empty-chest",
    sourceCode: "empty-chest",
    behaviour: { transitions: [], defaultLights: [] },
  });
  d.objects = [
    {
      id: "chest",
      modelId: object.id,
      x: 2.5,
      y: 3.5,
      placement: { tileId: "tile", point: 0 },
      rotation: 90,
      scale: 2,
    },
  ];
  models[0].canStand = true;
  models[0].placementPoints = [{ x: 0.5, y: 0.5, elevation: 0.5 }];
  syncLights(d, models);
  const before = clone(d.objects[0]);
  const result = transitionDocument(d, models, "object", "chest", edge);
  expect(result.valid).toBe(true);
  expect(result.document.objects[0]).toEqual({
    ...before,
    modelId: "empty-chest-version",
  });
  expect(result.document.lights.some((l) => l.anchor.id === "chest")).toBe(
    false,
  );
});
