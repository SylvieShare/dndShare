// Movement and a PBR liquid cutoff derived from the accepted painting recipes.
// Roughness separates water/foam from banks and wood; metallic excludes fittings.
import fs from "node:fs/promises";
import path from "node:path";
const cache = new Map();
async function recipe(file) {
  if (!cache.has(file))
    cache.set(
      file,
      fs
        .readFile(path.join(import.meta.dirname, file), "utf8")
        .then(JSON.parse),
    );
  return cache.get(file);
}
export async function waterAnimationProfile(model) {
  const code = model.sourceCode;
  let cutoff,
    centre = [0, 0],
    contained = false;
  if (model.collection === "medieval-town-vol1") {
    const spec = await recipe(`medieval-recipes/${code}.json`);
    const liquids =
      spec.materials?.surfaceParts?.filter((p) => p.kind === "liquid") || [];
    if (!liquids.length) return null;
    cutoff = Math.max(...liquids.map((p) => p.roughness)) + 0.08;
    centre = liquids[0].ellipsoid?.centerMM?.slice(0, 2) || centre;
    contained = true;
  } else if (model.collection === "ultimate-dungeon") {
    const spec = (await recipe("ultimate-water.json"))[code];
    if (spec) {
      cutoff = 0.33;
      contained = spec.variant === "well";
      centre = spec.centre || centre;
    } else {
      const fountain = (await recipe("ultimate-fountains.json"))[code];
      if (fountain?.variant !== "toxic") return null;
      cutoff = 0.4;
      contained = true;
      centre = [11.7, 0];
    }
  } else if (model.collection === "lost-cave") {
    const spec = await recipe(`lost-cave-recipes/${code}.json`);
    if (!spec.water && !spec.waterfall) return null;
    cutoff = spec.waterfall
      ? 0.5
      : Math.max(0.28, (spec.water.roughness || 0.18) + 0.105);
    contained = Boolean(spec.water?.surfaces?.length);
    centre = spec.water?.surfaces?.[0]?.centre || centre;
  } else if (model.collection === "majestic-highlands") {
    const spec = await recipe(`majestic-recipes/${code}.json`);
    if (!spec.water && !spec.waterfall) return null;
    cutoff =
      Math.max(spec.water?.roughness || 0, spec.waterfall?.roughness || 0) +
      0.08;
    if (cutoff <= 0.08)
      throw Error("Measured liquid roughness required: " + code);
  } else if (model.collection === "toxic-sewer") {
    const spec = await recipe(`toxic-sewer-recipes/${code}.json`);
    const liquids =
      spec.regions?.filter(
        (p) => p.part === "toxic" && (p.roughness ?? 0.32) < 0.8,
      ) || [];
    if (!liquids.length) return null;
    cutoff = Math.max(...liquids.map((p) => p.roughness ?? 0.32)) + 0.08;
    contained = /well|fountain/i.test(model.sourceName);
    centre = liquids[0].ellipsoid?.centre?.slice(0, 2) || centre;
  } else return null;
  return {
    enabled: true,
    speed: 1,
    strength: 0.7,
    pattern: /vortex/i.test(model.sourceName)
      ? "vortex"
      : contained
        ? "pool"
        : "surface",
    roughnessMax: Number(cutoff.toFixed(3)),
    center: [centre[0] / 35, -centre[1] / 35],
  };
}
