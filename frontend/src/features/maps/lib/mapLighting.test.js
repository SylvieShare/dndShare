import { expect, it } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { lightPose, lightOpacity, syncLights } from "./mapLighting";
import { newMap, clone } from "./mapModel";
import { useEditorJournal } from "../composables/useEditorJournal";

it("loading a server-shaped anchored light leaves the map clean and repeated synchronization unchanged", async () => {
  const source = newMap();
  source.id = "saved";
  const model = {
    id: "floor",
    tileType: "floor",
    width: 1,
    height: 1,
    surfaceHeight: 0.4,
    mountDepth: 0,
    behaviour: { defaultLights: [] },
  };
  source.document.tiles = [
    { id: "tile", modelId: model.id, x: 1, y: 1, rotation: 0, level: 0 },
  ];
  source.document.lights = [
    {
      id: "lamp",
      name: "Lamp",
      kind: "torch",
      color: "#ff9900",
      x: 1.5,
      y: 1.5,
      elevation: 0.4,
      height: 1,
      intensity: 8,
      radius: 4,
      enabled: true,
      showMarker: false,
      shadows: false,
      flicker: false,
      offset: [0, 0],
      anchor: { kind: "tile", id: "tile" },
    },
  ];
  const before = clone(source),
    draft = ref(source),
    scope = effectScope();
  const journal = scope.run(() => useEditorJournal(draft, true));
  syncLights(draft.value.document, [model]);
  await nextTick();
  expect(journal.dirty.value).toBe(false);
  expect(draft.value).toEqual(before);
  syncLights(draft.value.document, [model]);
  await nextTick();
  expect(journal.dirty.value).toBe(false);
  scope.stop();
});

it("clears obsolete area bindings without inserting an empty serialized field", () => {
  const d = {
    tiles: [],
    objects: [],
    areas: [],
    lights: [{ id: "lamp", areaId: "deleted" }],
  };
  syncLights(d, []);
  expect(d.lights[0]).not.toHaveProperty("areaId");
});
it("follows a rotated upper tile, including the body datum and local offset", () => {
  const tile = {
      id: "floor",
      modelId: "model",
      x: 2,
      y: 3,
      level: 1,
      rotation: 90,
    },
    model = {
      id: "model",
      width: 2,
      height: 1,
      mountDepth: 0.2,
      surfaceHeight: 0.6,
    };
  const d = { tiles: [tile], objects: [], areas: [] },
    light = {
      x: 0,
      y: 0,
      elevation: 0,
      height: 0.7,
      offset: [0.25, 0],
      anchor: { kind: "tile", id: "floor" },
    };
  const p = lightPose(light, d, [model], {
    placements: new Map([["floor", { elevation: 1 }]]),
  });
  expect(p.x).toBeCloseTo(2.5);
  expect(p.y).toBeCloseTo(4.25);
  expect(p.worldHeight).toBeCloseTo(2.1);
});
it("inherits hidden-area lighting from its anchor and removes lights whose support was deleted", () => {
  const light = {
    id: "lamp",
    anchor: { kind: "object", id: "chest" },
    areaId: "",
    x: 1,
    y: 1,
    height: 1,
    elevation: 0,
    offset: [0, 0],
  };
  const d = {
    tiles: [],
    objects: [{ id: "chest" }],
    areas: [{ id: "room", hidden: true, tileIds: [], objectIds: ["chest"] }],
    lights: [light],
  };
  expect(lightOpacity(light, d, "hide")).toBe(0);
  expect(lightOpacity(light, d, "ghost")).toBe(0.12);
  d.objects = [];
  syncLights(d, []);
  expect(d.lights).toEqual([]);
});
