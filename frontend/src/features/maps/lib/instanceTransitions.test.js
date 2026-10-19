import { expect, it } from "vitest";
import { newMap } from "./mapModel";
import {
  instanceTransitions,
  displayedTransitions,
} from "./instanceTransitions";
import { transitionDocument } from "./modelTransitions";
const native = { id: "native", action: "open", toDefinitionId: "B" };
const models = [
  {
    id: "a",
    definitionId: "A",
    name: "A",
    width: 1,
    height: 1,
    behaviour: { transitions: [native] },
  },
  { id: "b", definitionId: "B", name: "B", width: 1, height: 1 },
  { id: "c", definitionId: "C", name: "C", width: 1, height: 1 },
];
it("preserves all custom targets and original catalogue edges over several replacements and a return", () => {
  let document = newMap().document;
  document.tiles = [
    {
      id: "tile",
      modelId: "a",
      x: 1,
      y: 1,
      rotation: 0,
      level: 0,
      transitions: {
        originalModelId: "a",
        targets: [
          { id: "one", modelId: "b" },
          { id: "two", modelId: "c" },
          { id: "empty" },
        ],
      },
    },
  ];
  for (const key of ["custom:one", "custom:two", "return"]) {
    const transitions = instanceTransitions(document, models, "tile", "tile");
    const result = transitionDocument(
      document,
      models,
      "tile",
      "tile",
      transitions.find((t) => t.key === key),
    );
    expect(result.valid).toBe(true);
    document = result.document;
    expect(document.tiles[0].transitions.targets).toHaveLength(3);
    expect(
      instanceTransitions(document, models, "tile", "tile").some(
        (t) => t.id === "native",
      ),
    ).toBe(true);
  }
  expect(document.tiles[0].modelId).toBe("a");
  expect(
    instanceTransitions(document, models, "tile", "tile").some((t) => t.return),
  ).toBe(false);
});
it("rejects an empty target, unlisted target, current variant and invalid footprint without removing attached lights", () => {
  const document = newMap().document;
  document.tiles = [
    {
      id: "tile",
      modelId: "a",
      x: 29,
      y: 1,
      rotation: 0,
      level: 0,
      transitions: {
        originalModelId: "a",
        targets: [
          { id: "one", modelId: "b" },
          { id: "same", modelId: "a" },
          { id: "empty" },
        ],
      },
    },
  ];
  document.lights = [{ id: "lamp", anchor: { kind: "tile", id: "tile" } }];
  const wide = models.map((m) => (m.id === "b" ? { ...m, width: 2 } : m));
  for (const key of [
    "custom:one",
    "custom:same",
    "custom:empty",
    "custom:forged",
  ]) {
    expect(
      transitionDocument(document, wide, "tile", "tile", { key }).valid,
    ).toBe(false);
  }
  expect(document.lights).toHaveLength(1);
  expect(document.tiles[0].modelId).toBe("a");
});

it("shows each target once, hides the current variant and preserves every configured edge", () => {
  const document = newMap().document;
  const catalogue = models.map((m) => ({ ...m }));
  catalogue[1].behaviour = {
    transitions: [
      { id: "close", action: "close", toDefinitionId: "A" },
      { id: "again", action: "fill", toDefinitionId: "A" },
    ],
  };
  document.tiles = [
    {
      id: "tile",
      modelId: "b",
      transitions: {
        originalModelId: "a",
        targets: [
          { id: "back", modelId: "a" },
          { id: "current", modelId: "b" },
          { id: "blank1" },
          { id: "blank2" },
        ],
      },
    },
  ];
  const before = JSON.stringify(document);
  let rows = displayedTransitions(document, catalogue, "tile", "tile");
  expect(rows.map((row) => row.key)).toEqual([
    "custom:back",
    "custom:blank1",
    "custom:blank2",
  ]);
  expect(JSON.stringify(document)).toBe(before);
  document.tiles[0].transitions.targets.shift();
  rows = displayedTransitions(document, catalogue, "tile", "tile");
  expect(
    rows.filter((row) => row.modelId === "a").map((row) => row.id),
  ).toEqual(["close"]);
  catalogue[1].behaviour.transitions = [];
  expect(
    displayedTransitions(document, catalogue, "tile", "tile").find(
      (row) => row.modelId === "a",
    ).return,
  ).toBe(true);
});
