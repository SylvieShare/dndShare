import { expect, it } from "vitest";
import {
  lightBaseHeight,
  lightSourceOffset,
  sourceHeightAtBase,
  withLightSourceOffset,
} from "./lightEffect";
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
