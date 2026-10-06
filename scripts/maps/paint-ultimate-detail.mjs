import { individualPainter } from "./individual_painter.mjs";
// Deliberately prepare one reviewed catalogue entry per invocation.
import earlierSpecs from "./ultimate-detail.json" with { type: "json" };
import furnitureSpecs from "./ultimate-furniture.json" with { type: "json" };
import lightingSpecs from "./ultimate-lighting.json" with { type: "json" };
import fountainSpecs from "./ultimate-fountains.json" with { type: "json" };
import floorSpecs from "./ultimate-floors.json" with { type: "json" };
import prisonSpecs from "./ultimate-prison.json" with { type: "json" };
import tortureSpecs from "./ultimate-torture.json" with { type: "json" };
import utilitySpecs from "./ultimate-utility.json" with { type: "json" };
import weaponsSpecs from "./ultimate-weapons.json" with { type: "json" };
import smallWallSpecs from "./ultimate-small-walls.json" with { type: "json" };
import waterSpecs from "./ultimate-water.json" with { type: "json" };
import archSpecs from "./ultimate-arches.json" with { type: "json" };
import altarSpecs from "./ultimate-altars.json" with { type: "json" };
import doubleDoorSpecs from "./ultimate-double-doors.json" with { type: "json" };
import { prepareSurfaceRevision } from "./prepare-surface-revision.mjs";
import { paintFloorJoint } from "./floor_seams.mjs";
import fs from "node:fs/promises";
import path from "node:path";
const specs = {
  ...earlierSpecs,
  ...furnitureSpecs,
  ...lightingSpecs,
  ...fountainSpecs,
  ...floorSpecs,
  ...prisonSpecs,
  ...tortureSpecs,
  ...utilitySpecs,
  ...weaponsSpecs,
  ...smallWallSpecs,
  ...waterSpecs,
  ...archSpecs,
  ...altarSpecs,
  ...doubleDoorSpecs,
};
const code = process.argv[2];
const requestedName = process.argv
  .find((a) => a.startsWith("--source-name="))
  ?.slice(14);
const spec = Object.entries(specs).find(
  ([key, value]) =>
    (value.sourceCode ?? key) === code &&
    (!requestedName || value.sourceName === requestedName),
)?.[1];
if (!spec)
  throw new Error("No individually reviewed material specification: " + code);
const registry = JSON.parse(
  await fs.readFile(
    path.resolve(import.meta.dirname, "../../models/collections/registry.json"),
    "utf8",
  ),
);
const versions = registry
  .filter(
    (m) =>
      m.collection === "ultimate-dungeon" &&
      m.sourceCode === code &&
      m.sourceName === spec.sourceName,
  )
  .sort((a, b) => b.version - a.version);
const model = versions[0];
if (model.textureDetail === "detailed" && !process.argv.includes("--force"))
  throw new Error("Already detailed: " + code);
let reference;
const collectionBase = path.resolve(
  import.meta.dirname,
  "../../models/collections",
);
for (const entry of await fs.readdir(
  path.join(collectionBase, "stone-dungeon"),
  { withFileTypes: true },
)) {
  if (!entry.isDirectory() || entry.name === "upload") continue;
  const r = JSON.parse(
    await fs.readFile(
      path.join(collectionBase, "stone-dungeon", entry.name, "report.json"),
      "utf8",
    ),
  );
  if (r.model.sourceCode === code && r.model.sourceName === spec.sourceName)
    reference = r.model;
}
if (!reference) throw new Error("Missing original colour-bake reference");
const sourceRows = JSON.parse(
  await fs.readFile(path.join(collectionBase, "manifest.json"), "utf8"),
);
const row = sourceRows.find(
  (r) =>
    r.collection === model.collection &&
    r.code === code &&
    r.sourceName === spec.sourceName,
);
const { painter, parts } = await individualPainter({
  code,
  spec,
  model,
  collectionBase,
});
await prepareSurfaceRevision({
  code,
  sourceName: spec.sourceName,
  folder: "ultimate-detail/" + code,
  recipe: "ultimate-individual-materials-v1",
  paintPixel: (rgb, p, n, ao) => {
    const painted = painter(rgb, p, n, ao);
    if (!["stone", "base", "floor", "wall"].includes(painted.part))
      return painted;
    return {
      ...painted,
      rgb: paintFloorJoint(
        painted.rgb,
        p,
        n,
        row.cutHeight,
        [model.width * 17.5, model.height * 17.5],
        ao,
        spec.floorSeams !== "ao-only",
      ).rgb,
    };
  },
  parts,
  updateMetallic: true,
  colorReferenceVersion: reference.version,
  sampleAO: true,
});
