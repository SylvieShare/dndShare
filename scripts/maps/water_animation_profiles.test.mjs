import test from "node:test";
import assert from "node:assert/strict";
import { waterAnimationProfile } from "./water_animation_profiles.mjs";
const model = (collection, sourceCode, sourceName) => ({
  collection,
  sourceCode,
  sourceName,
});
test("dry channels, empty containers, crystals and treasure are never animated", async () => {
  for (const m of [
    model("toxic-sewer", "TS-064", "Water Empty"),
    model("toxic-sewer", "TS-076", "Water Outlet Off"),
    model("lost-cave", "LC-067", "Well Wall Empty"),
    model("ultimate-dungeon", "UD-042", "Fountain Crystal"),
    model("medieval-town-vol1", "MT1-075", "Bath Objects"),
  ])
    assert.equal(await waterAnimationProfile(m), null);
});
test("water without a water tag is included, and pools have their measured centres", async () => {
  const well = await waterAnimationProfile(
    model("lost-cave", "LC-064", "Well Wall Full 1"),
  );
  assert.equal(well.pattern, "pool");
  assert.ok(well.roughnessMax < 0.4);
  const bath = await waterAnimationProfile(
    model("medieval-town-vol1", "MT1-074", "Bath Water"),
  );
  assert.equal(bath.pattern, "pool");
  assert.equal(bath.roughnessMax, 0.36);
  assert.ok(bath.center[0] > 0 && bath.center[1] < 0);
});
test("foam is included in waterfalls while tentacles and matte liquid supports stay dry", async () => {
  const fall = await waterAnimationProfile(
    model("majestic-highlands", "MH-163", "High Waterfall"),
  );
  assert.equal(fall.pattern, "surface");
  assert.equal(fall.roughnessMax, 0.56);
  const sewer = await waterAnimationProfile(
    model("toxic-sewer", "TS-093", "Water Tentacles"),
  );
  assert.equal(sewer.roughnessMax, 0.4);
  assert.ok(sewer.roughnessMax < 0.62 && sewer.roughnessMax < 0.88);
  const vortex = await waterAnimationProfile(
    model("lost-cave", "LC-100", "Water Vortex"),
  );
  assert.equal(vortex.pattern, "vortex");
});
