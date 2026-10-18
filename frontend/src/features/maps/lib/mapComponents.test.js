import { expect, it } from "vitest";
import { newMap } from "./mapModel";
import { syncLights } from "./mapLighting";
import { componentEnabled, flagEnabled } from "./mapComponents";
import { flagDependencies } from "./editorEntities";

const model = {
  id: "base",
  definitionId: "base",
  name: "Факел",
  width: 1,
  height: 1,
  mountDepth: 0.2,
  surfaceHeight: 0.4,
  maxHeight: 1.7,
  supportSlots: [],
  behaviour: {
    defaultFlags: [{ key: "burning", name: "Горит", enabled: true }],
    defaultLights: [
      {
        key: "lamp",
        name: "Свет",
        kind: "torch",
        position: [0.3, 0.4, 1.5],
        color: "#ffb04a",
        radius: 4,
        intensity: 8,
        enabled: true,
      },
    ],
    defaultEffects: [
      {
        key: "fire",
        name: "Пламя",
        kind: "fire",
        position: [0.3, 0.4, 1.3],
        color: "#ffb04a",
        size: [0.2, 0.35],
        strength: 0.7,
        enabled: true,
        flagKey: "burning",
      },
    ],
  },
};
model.behaviour.defaultLights[0].flagKey = "burning";

it("hydrates a shared flag with independent light and fire entities and preserves its state", () => {
  const d = newMap().document;
  d.tiles = [
    { id: "torch", modelId: "base", x: 2, y: 3, rotation: 90, level: 0 },
  ];
  syncLights(d, [model]);
  expect(d.flags).toHaveLength(1);
  expect(d.effects).toHaveLength(1);
  expect(d.lights).toHaveLength(1);
  const id = d.flags[0].id;
  expect(d.lights[0].flagId).toBe(id);
  expect(d.effects[0].flagId).toBe(id);
  expect(
    flagDependencies({ draft: { document: d }, catalogue: [model] }, id).map(
      (x) => x.kind,
    ),
  ).toEqual(["light", "effect"]);
  d.flags[0].enabled = false;
  expect(componentEnabled(d, d.lights[0])).toBe(false);
  expect(componentEnabled(d, d.effects[0])).toBe(false);
  syncLights(d, [model]);
  expect(d.flags[0]).toMatchObject({ id, enabled: false });
  expect(d.lights[0].enabled).toBe(true);
  expect(d.effects[0].enabled).toBe(true);
  d.flags[0].enabled = true;
  expect(componentEnabled(d, d.effects[0])).toBe(true);
  d.effects[0].enabled = false;
  expect(componentEnabled(d, d.effects[0])).toBe(false);
});

it("prunes components when their owner is removed and detaches deleted control flags", () => {
  const d = newMap().document;
  d.flags = [{ id: "manual", name: "Ручной", enabled: false }];
  d.effects = [{ id: "manual-fire", flagId: "manual", enabled: true }];
  syncLights(d, []);
  expect(componentEnabled(d, d.effects[0])).toBe(false);
  d.flags = [];
  syncLights(d, []);
  expect(d.effects[0].flagId).toBe("");
  expect(componentEnabled(d, d.effects[0])).toBe(true);
  expect(flagEnabled(d, "missing")).toBe(false);
  d.tiles = [
    { id: "torch", modelId: "base", x: 1, y: 1, rotation: 0, level: 0 },
  ];
  syncLights(d, [model]);
  d.tiles = [];
  syncLights(d, [model]);
  expect(d.flags).toEqual([]);
  expect(d.lights).toEqual([]);
  expect(d.effects).toHaveLength(1);
});
