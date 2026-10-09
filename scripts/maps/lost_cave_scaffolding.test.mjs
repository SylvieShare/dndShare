import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import {
  scaffoldBoltAt,
  scaffoldBeamAt,
  scaffoldInnerAt,
  paintScaffolding,
} from "./lost_cave_scaffolding.mjs";
const s = specs["LC-061"];
test("measured frame members keep horizontal, vertical and diagonal timber directions", () => {
  assert.equal(scaffoldBeamAt([-8.7259, -17.5, 22.9445], s).axis, "x");
  assert.equal(scaffoldBeamAt([17.4383, -2.8421, 27.1287], s).axis, "y");
  assert.equal(scaffoldBeamAt([12.9394, -17.5, 22.0315], s).axis, "z");
  assert.equal(scaffoldBeamAt([-11.9649, -16.535, 5.5484], s).axis, "x");
  assert(scaffoldBeamAt([4.7095, -16.3067, 9.8125], s).slope < 0);
  assert(scaffoldBeamAt([-4.7095, -16.3067, 9.8125], s).slope > 0);
  assert.equal(
    scaffoldBeamAt([-5.6144, -16.1973, 13.049], s).slope,
    undefined,
    "Lower panel edge is not a brace",
  );
  assert.equal(
    scaffoldBeamAt([-4.1756, 5.0115, 13.5756], s),
    undefined,
    "Central stone stays non-timber",
  );
});
test("only eight native heads are metal, with no invented upper Y or lower X bolts", () => {
  assert.equal(s.scaffolding.bolts.length, 8);
  for (const [p, n] of [
    [
      [-14.8831, -17.4619, 8.1801],
      [-0.1354, -0.9724, 0.19],
    ],
    [
      [14.9235, -17.4676, 7.9784],
      [-0.0275, -0.9953, 0.0933],
    ],
    [
      [17.3905, -14.9234, 26.0075],
      [0.9342, -0.1543, 0.3216],
    ],
    [
      [17.3057, 14.7621, 25.2815],
      [0.9596, -0.0297, 0.2799],
    ],
  ])
    assert(scaffoldBoltAt(p, n, s));
  for (const [p, n] of [
    [
      [-15.0393, -17.4734, 25.945],
      [0.5124, -0.8581, 0.0338],
    ],
    [
      [17.5, 15, 7.7],
      [1, 0, 0],
    ],
    [
      [-12.5, -17.5, 8],
      [0, -1, 0],
    ],
    [
      [-14.85, -13.5, 8.08],
      [0, 1, 0],
    ],
  ])
    assert.equal(scaffoldBoltAt(p, n, s), undefined);
});
test("smooth inward lining uses geometry normals while outer sculpted timber and stone keep relief", () => {
  const p = [11.3872, 13.499, 22.8161],
    n = [-0.0009, -1, -0.0004];
  assert(scaffoldInnerAt(p, n, s));
  assert(paintScaffolding(p, n, 240, s).normalNeutral);
  assert(!scaffoldInnerAt([-8.7259, -17.5, 22.9445], [0, -1, 0], s));
  const iron = paintScaffolding(
    [-14.8831, -17.4619, 8.1801],
    [-0.1354, -0.9724, 0.19],
    240,
    s,
  );
  assert.equal(iron.part, "iron");
  assert(iron.metallic > 0.5 && iron.metallic < 0.75);
  for (const [p, n, part] of [
    [[-8.7259, -17.5, 22.9445], [0, -1, 0], "wood"],
    [[-4.1756, 5.0115, 13.5756], [0, 0, 1], "rock"],
  ]) {
    const v = paintScaffolding(p, n, 240, s);
    assert.equal(v.part, part);
    assert.equal(v.metallic, 0);
    assert(v.rgb.every((c) => c > 4));
  }
});
