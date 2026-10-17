import { expect, it } from "vitest";
import { syncBuiltinLights, builtinLightPose } from "./builtinLights";
import { lightArea } from "./mapLighting";
const model = {
  id: "model",
  definitionId: "UD-test",
  name: "Стена",
  width: 1,
  height: 1,
  surfaceHeight: 0.4,
  mountDepth: 0,
  behaviour: {
    defaultLights: [
      {
        key: "flame",
        name: "Факел",
        kind: "torch",
        color: "#ffcc88",
        position: [0.5, 0.5, 1],
        intensity: 8,
        radius: 4,
        enabled: true,
        flicker: true,
      },
    ],
  },
};
it("preserves per-instance changes and keeps following unedited model defaults", () => {
  const document = {
    tiles: [
      { id: "tile", modelId: "model", x: 1, y: 1, rotation: 0, level: 0 },
    ],
    objects: [],
    lights: [],
  };
  syncBuiltinLights(document, [model]);
  document.lights[0].overrides = {
    color: "#112233",
    intensity: 15,
    height: 2.4,
    shadows: true,
    showMarker: true,
    flicker: false,
  };
  syncBuiltinLights(document, [model]);
  expect(document.lights[0]).toMatchObject({
    name: "Факел",
    color: "#112233",
    intensity: 15,
    radius: 4,
    height: 2.4,
    shadows: true,
    showMarker: true,
    flicker: false,
  });
  const changed = {
    ...model,
    behaviour: {
      defaultLights: [{ ...model.behaviour.defaultLights[0], radius: 7 }],
    },
  };
  syncBuiltinLights(document, [changed]);
  expect(document.lights[0]).toMatchObject({ intensity: 15, radius: 7 });
  const pose = builtinLightPose(document.lights[0], document, [changed]);
  expect(pose.height).toBe(2.4);
  expect(pose.worldHeight).toBeCloseTo(2.4);
});
it("uses world height for object-bound defaults and overrides, without scaling an override twice", () => {
  const document = {
    tiles: [],
    objects: [
      { id: "object", modelId: "model", x: 3, y: 4, rotation: 0, scale: 2 },
    ],
    lights: [],
  };
  syncBuiltinLights(document, [model]);
  expect(document.lights[0].height).toBe(2);
  document.lights[0].overrides = { height: 3 };
  syncBuiltinLights(document, [model]);
  expect(builtinLightPose(document.lights[0], document, [model]).height).toBe(
    3,
  );
});
it("inherits a bound light's area instead of retaining an independent area override", () => {
  const document = {
    areas: [
      { id: "old", tileIds: [], objectIds: [] },
      { id: "parent", tileIds: ["tile"], objectIds: [] },
    ],
  };
  expect(
    lightArea(
      { areaId: "old", anchor: { kind: "tile", id: "tile" } },
      document,
    ),
  ).toBe("parent");
});
