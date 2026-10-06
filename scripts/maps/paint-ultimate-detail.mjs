// Deliberately prepare one reviewed catalogue entry per invocation.
import specs from "./ultimate-detail.json" with { type: "json" };
import { prepareSurfaceRevision } from "./prepare-surface-revision.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { makeRaisedPainter } from "./raised_material.mjs";
import { paintFloorJoint } from "./floor_seams.mjs";
import { makeMetalPainter } from "./measured_metal.mjs";
import { paintDoorBar } from "./ultimate_door.mjs";
import fs from "node:fs/promises";
import path from "node:path";
const code = process.argv[2],
  spec = specs[code];
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
if (model.textureDetail === "detailed")
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
let painter = (rgb, p, n) => paintStone(rgb, p, n, spec),
  parts = ["base", "floor", "wall"];
if (spec.material === "stone" && model.maxHeight * 35 <= 15.9)
  parts = model.maxHeight * 35 <= 13.4 ? ["base"] : ["base", "floor"];
if (spec.material === "bones") {
  const floor = JSON.parse(
    await fs.readFile(
      path.resolve(
        import.meta.dirname,
        "../../models/collections",
        spec.floorReference,
      ),
      "utf8",
    ),
  );
  painter = makeRaisedPainter(floor, spec);
  parts = ["stone", "bone"];
} else if (spec.material === "door-bar") {
  painter = paintDoorBar;
  parts = ["stone", "wood", "iron"];
} else if (spec.material.startsWith("iron-")) {
  painter = makeMetalPainter(spec);
  parts = ["stone", "iron"];
} else if (spec.material !== "stone") throw new Error("Unimplemented material");
await prepareSurfaceRevision({
  code,
  sourceName: spec.sourceName,
  folder: "ultimate-detail/" + code,
  recipe: "ultimate-individual-materials-v1",
  paintPixel: (rgb, p, n, ao) => {
    const painted = painter(rgb, p, n);
    if (
      ["iron", "wood", "bone", "cloth", "water", "gold", "crystal"].includes(
        painted.part,
      )
    )
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
      ).rgb,
    };
  },
  parts,
  updateMetallic: true,
  colorReferenceVersion: reference.version,
  sampleAO: true,
});
