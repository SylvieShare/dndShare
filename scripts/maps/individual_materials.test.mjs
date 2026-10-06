import test from "node:test";
import assert from "node:assert/strict";
import { pedestalPartAt } from "./ud025_material.mjs";
import { bedPartAt } from "./bed_material.mjs";
import { wallBagsPartAt } from "./sacks_material.mjs";
import { fitBakedMaterials } from "./material_mixture.mjs";
import { srgbToLinear, OLD_STONE } from "./masonry_palette.mjs";
import { floorJointWeight } from "./floor_seams.mjs";
test("UD-025 has stone cap and pillars, ivory skulls, and actual hanging iron links", () => {
  assert.equal(pedestalPartAt([-9.85, -2.29, 31.63]), "stone");
  assert.equal(pedestalPartAt([-11.03, 10.79, 39.25]), "stone");
  assert.equal(pedestalPartAt([0.28, 0.35, 46.91]), "bone");
  assert.equal(pedestalPartAt([-11.9, -5.94, 32.79]), "iron");
  assert.equal(pedestalPartAt([5.18, -8.98, 33.38]), "iron");
});
test("UD-027 keeps fallen stones grey and covers frame, pillow, straw and cloth tails", () => {
  assert.equal(bedPartAt([-28, 0, 18]), "stone");
  assert.equal(bedPartAt([25.32, -11.61, 33.38]), "wood");
  assert.equal(bedPartAt([19.58, -0.54, 34.13]), "pillow");
  assert.equal(bedPartAt([18.45, 9.62, 27.58]), "straw");
  assert.equal(bedPartAt([-5, -14, 22]), "cloth");
  assert.equal(bedPartAt([-5, -14, 18]), "wood");
});
test("UD-028 treats lower cloth correctly without recolouring the nearby stone chip", () => {
  assert.equal(wallBagsPartAt([-15.14, -6.59, 22.86]), "sack-front");
  assert.equal(wallBagsPartAt([-16.28, -6.06, 20]), "sack-front");
  assert.equal(wallBagsPartAt([-15.03, -8.96, 22.26]), "sack-front");
  assert.equal(wallBagsPartAt([-14.8, 7, 17.2]), "stone");
  assert.equal(wallBagsPartAt([-8.44, 10.57, 22.74]), "ceramic");
  assert.equal(wallBagsPartAt([-0.94, -7.1, 21.11]), "wood");
});
test("material reconstruction retains source grain across mixed pigment boundaries", () => {
  const pigments = [
    OLD_STONE,
    [0.39, 0.22, 0.105],
    [0.39, 0.17, 0.14],
    [0.57, 0.49, 0.29],
  ];
  const detail = fitBakedMaterials(pigments),
    toSrgb = (v) =>
      v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  const rgb = [0, 1, 2].map((i) =>
    Math.round(
      toSrgb(
        0.8 *
          (srgbToLinear(pigments[0][i]) * 0.4 +
            srgbToLinear(pigments[2][i]) * 0.6),
      ) * 255,
    ),
  );
  assert.ok(Math.abs(detail(rgb) - 0.8) < 0.035);
});
test("low frame rims use AO instead of being mistaken for recessed floor mortar", () => {
  assert.equal(
    floorJointWeight(
      [85, 94, 99],
      [0, 0, 13.15],
      [0, 0, 1],
      11.5,
      [17.5, 17.5],
      255,
      false,
    ),
    0,
  );
  assert.ok(
    floorJointWeight(
      [85, 94, 99],
      [0, 0, 13.15],
      [0, 0, 1],
      11.5,
      [17.5, 17.5],
      195,
      false,
    ) > 0.8,
  );
});
