import { expect, it } from "vitest";
import {
  lightEffectPose,
  lightBaseHeight,
  lightSourceOffset,
  sourceHeightAtBase,
  withLightSourceOffset,
} from "./lightEffect";
import { lightPose } from "./mapLighting";
import { mirrorTileGroup } from "./mapGroupMirror";
it("reflects the off-centre fireplace source and its flame along the same world axis at every rotation", () => {
  const model = {
    id: "fireplace",
    width: 1,
    height: 1,
    mountDepth: 0.153517,
    placementOffset: [0.04, -0.03],
    behaviour: {
      defaultLights: [{ key: "fire", position: [0.557143, 0.5, 0.528571] }],
    },
  };
  const light = {
    id: "flame",
    builtinKey: "fire",
    anchor: { kind: "tile", id: "tile" },
    height: 0.528571,
    effect: {
      offset: [-0.108572, 0.025, -0.157142],
      size: [0.46, 0.37],
      strength: 0,
    },
  };
  for (const rotation of [0, 90, 180, 270]) {
    const tile = { id: "tile", modelId: model.id, x: 2, y: 3, rotation };
    const context = { placements: new Map([["tile", { elevation: 0 }]]) };
    const doc = { tiles: [tile], objects: [] };
    const source = lightPose(light, doc, [model], context),
      flame = lightEffectPose(light, doc, source);
    const reflected = { ...doc, tiles: mirrorTileGroup(doc.tiles, [model]) };
    const mirroredSource = lightPose(light, reflected, [model], context),
      mirroredFlame = lightEffectPose(light, reflected, mirroredSource);
    expect(mirroredSource.x).toBeCloseTo(5 - source.x);
    expect(mirroredSource.y).toBeCloseTo(source.y);
    expect(mirroredFlame.x).toBeCloseTo(5 - flame.x);
    expect(mirroredFlame.y).toBeCloseTo(flame.y);
    expect(mirroredFlame.worldHeight).toBeCloseTo(flame.worldHeight);
  }
});
it("moves the source independently of the flame base and moves both with height", () => {
  const light = {
    height: 1.8,
    effect: {
      kind: "fire",
      size: [0.22, 0.35],
      strength: 0.7,
      offset: [0.01, 0.02, -0.2],
    },
  };
  const changed = { ...light, ...withLightSourceOffset(light, 0.6) };
  expect(changed.height).toBeCloseTo(2.2);
  expect(lightBaseHeight(changed)).toBeCloseTo(1.6);
  expect(lightSourceOffset(changed)).toBe(0.6);
  expect(changed.effect.offset.slice(0, 2)).toEqual([0.01, 0.02]);
  expect(sourceHeightAtBase(changed, 2)).toBe(2.6);
  expect(light.effect.offset[2]).toBe(-0.2);
  expect(
    lightBaseHeight({ position: [0.5, 0.5, 1.8], effect: light.effect }),
  ).toBeCloseTo(1.6);
});
