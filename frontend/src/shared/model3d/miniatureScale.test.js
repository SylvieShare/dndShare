import { expect, it } from "vitest";
import {
  miniatureBaseDiameter,
  miniatureBaseScale,
  miniatureBodyScale,
} from "./miniatureScale";

it.each([
  [0.5, 0.35],
  [1, 0.7],
  [2, 1.7],
  [3, 2.7],
  [4, 3.7],
  [8, 7.7],
])("keeps size %s base diameter at %s cells", (size, diameter) => {
  expect(miniatureBaseDiameter(size)).toBeCloseTo(diameter);
  expect(miniatureBaseScale(size, 0.9 * size) * 0.9 * size).toBeCloseTo(
    diameter,
  );
});
it.each([0.5, 1, 2, 3, 4, 6, 8])(
  "scales size %s body proportionally to its one-cell version",
  (size) => {
    expect(
      miniatureBodyScale(size, 0.9) / miniatureBodyScale(1, 0.9),
    ).toBeCloseTo(size);
  },
);
it("compensates the additional Large-body growth while preserving its base", () => {
  expect(miniatureBodyScale(2, 0.9)).toBeCloseTo(1.4 / 0.9);
  expect(miniatureBodyScale(2, 0.9) / miniatureBaseScale(2, 0.9)).toBeCloseTo(
    14 / 17,
  );
  expect(miniatureBaseScale(2, 1.8)).toBeCloseTo(1.7 / 1.8);
});
it.each([0, -1, NaN, Infinity, undefined])(
  "rejects invalid size/calibration %s",
  (value) => {
    for (const scale of [miniatureBodyScale, miniatureBaseScale]) {
      expect(() => scale(1, value)).toThrow(RangeError);
      expect(() => scale(value, 0.9)).toThrow(RangeError);
    }
  },
);
