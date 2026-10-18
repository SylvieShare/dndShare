import { expect, it } from "vitest";
import { fireClock, fireMotion } from "./fireMotion";
it("uses one stable 12 FPS phase for the flame, point and brightness", () => {
  const light = {
    id: "torch",
    effect: { kind: "fire", size: [0.22, 0.35], strength: 0.7 },
  };
  expect(fireClock(110)).toBe(1 / 12);
  expect(fireMotion(light, 110)).toEqual(fireMotion(light, 140));
  expect(fireMotion(light, 170)).not.toEqual(fireMotion(light, 140));
  const stopped = { offset: [0, 0, 0], gain: 1, moving: false };
  expect(fireMotion(light, 170, true)).toEqual(stopped);
  expect(
    fireMotion({ ...light, effect: { ...light.effect, strength: 0 } }, 170),
  ).toEqual(stopped);
  const strong = fireMotion(
      { ...light, effect: { ...light.effect, strength: 1.4 } },
      170,
    ),
    weak = fireMotion(light, 170);
  expect(strong.offset[1]).toBeCloseTo(weak.offset[1] * 2);
  expect(strong.gain - 1).toBeCloseTo((weak.gain - 1) * 2);
});
