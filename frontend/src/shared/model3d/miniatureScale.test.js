import { expect, it } from "vitest";
import { miniatureDiameter, miniatureScale } from "./miniatureScale";

it.each([
  [0.5, 0.35],
  [1, 0.7],
  [2, 1.7],
  [3, 2.7],
  [4, 3.7],
  [8, 7.7],
])("gives size %s a standing diameter of %s cells", (size, diameter) =>
  expect(miniatureDiameter(size)).toBeCloseTo(diameter),
);
it("uses artist calibration regardless of appendages, parts or LOD geometry", () => {
  expect(miniatureScale(1, 0.9)).toBeCloseTo(0.7777777778);
  expect(miniatureScale(2, 0.9)).toBeCloseTo(1.888888889);
  expect(miniatureScale(2, 1.8)).toBeCloseTo(0.9444444444);
});
it.each([0, -1, NaN, Infinity, undefined])(
  "rejects missing/invalid calibration %s",
  (value) => {
    expect(() => miniatureScale(1, value)).toThrow(RangeError);
    expect(() => miniatureScale(value, 0.9)).toThrow(RangeError);
  },
);
