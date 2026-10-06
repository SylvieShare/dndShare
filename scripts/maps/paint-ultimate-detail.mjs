// Deliberately prepare one reviewed catalogue entry per invocation.
import earlierSpecs from "./ultimate-detail.json" with { type: "json" };
import furnitureSpecs from "./ultimate-furniture.json" with { type: "json" };
import lightingSpecs from "./ultimate-lighting.json" with { type: "json" };
import fountainSpecs from "./ultimate-fountains.json" with { type: "json" };
import { prepareSurfaceRevision } from "./prepare-surface-revision.mjs";
import { paintStone } from "./ultimate_surface.mjs";
import { makeRaisedPainter } from "./raised_material.mjs";
import { paintFloorJoint } from "./floor_seams.mjs";
import { makeMetalPainter } from "./measured_metal.mjs";
import { paintDoorBar } from "./ultimate_door.mjs";
import { makeBridgePainter } from "./bridge_material.mjs";
import { makeAddedBonePainter } from "./added_bones.mjs";
import { paintPedestal } from "./ud025_material.mjs";
import { makeBedPainter } from "./bed_material.mjs";
import { paintWallBags, paintGroundBags } from "./sacks_material.mjs";
import { makeTablePainter } from "./table_material.mjs";
import { paintBarrel } from "./barrel_material.mjs";
import { paintWoodFloor } from "./wood_floor_material.mjs";
import { makeTorchPainter } from "./torch_material.mjs";
import { paintBrazier } from "./brazier_material.mjs";
import { makeFountainPainter } from "./fountain_material.mjs";
import fs from "node:fs/promises";
import path from "node:path";
const specs = {
  ...earlierSpecs,
  ...furnitureSpecs,
  ...lightingSpecs,
  ...fountainSpecs,
};
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
const datum = spec.datum ?? 13.4;
let painter = (rgb, p, n) => paintStone(rgb, p, n, spec),
  parts = ["base", "floor", "wall"];
if (spec.material === "stone" && model.maxHeight * 35 <= datum + 2.5)
  parts = model.maxHeight * 35 <= datum ? ["base"] : ["base", "floor"];
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
} else if (spec.material === "added-bones") {
  const directory = path.join(collectionBase, "added-reference", code);
  const reference = {
    spec: JSON.parse(
      await fs.readFile(path.join(directory, "reference.json"), "utf8"),
    ),
    data: await fs.readFile(path.join(directory, "distance.bin")),
  };
  painter = makeAddedBonePainter(reference, spec);
  parts = ["stone", "bone"];
} else if (spec.material === "fountain") {
  let bare;
  if (spec.bareReference) {
    const directory = path.join(collectionBase, "added-reference", code);
    bare = {
      spec: JSON.parse(
        await fs.readFile(path.join(directory, "reference.json"), "utf8"),
      ),
      data: await fs.readFile(path.join(directory, "distance.bin")),
    };
    if (
      bare.spec.bare !== spec.bareReference ||
      bare.spec.wall !== spec.bareWallReference ||
      bare.spec.bareMaxZ !== spec.bareMaxZ
    )
      throw new Error("Unexpected bare fountain reference: " + code);
  }
  painter = makeFountainPainter(spec, bare);
  parts = {
    empty: ["stone", "bone", "iron"],
    crystal: ["stone", "crystal"],
    toxic: ["stone", "bone", "toxic"],
    treasure: ["stone", "gold", "silver", "gem"],
  }[spec.variant];
} else if (spec.material === "brazier") {
  painter = paintBrazier;
  parts = ["stone", "iron", "charcoal"];
} else if (spec.material === "torch") {
  let bare;
  if (spec.bareReference) {
    const directory = path.join(collectionBase, "added-reference", code);
    bare = {
      spec: JSON.parse(
        await fs.readFile(path.join(directory, "reference.json"), "utf8"),
      ),
      data: await fs.readFile(path.join(directory, "distance.bin")),
    };
    if (bare.spec.bare !== spec.bareReference)
      throw new Error("Unexpected bare torch reference: " + code);
  }
  painter = makeTorchPainter(spec, bare);
  parts = [
    "stone",
    "wood",
    "iron",
    ...(spec.lit ? ["flame"] : ["charcoal", "ash"]),
  ];
} else if (spec.material === "wood-floor") {
  painter = (rgb, p, n) => paintWoodFloor(rgb, p, n, spec);
  parts = ["stone", "wood", "iron"];
} else if (spec.material === "barrel") {
  painter = paintBarrel;
  parts = ["stone", "wood", "chain", "hoop"];
} else if (spec.material === "table") {
  let bare;
  if (spec.bareReference) {
    const directory = path.join(collectionBase, "added-reference", code);
    bare = {
      spec: JSON.parse(
        await fs.readFile(path.join(directory, "reference.json"), "utf8"),
      ),
      data: await fs.readFile(path.join(directory, "distance.bin")),
    };
    if (bare.spec.bare !== spec.bareReference)
      throw new Error("Unexpected bare furniture reference: " + code);
  }
  painter = makeTablePainter(spec, bare);
  parts = spec.full
    ? ["stone", "wood", "plate", "ceramic", "iron", "basket", "fruit"]
    : ["stone", "wood"];
} else if (spec.material === "ground-bags") {
  painter = paintGroundBags;
  parts = ["stone", "ceramic", "leather", "cloth", "rope"];
} else if (spec.material === "wall-bags") {
  painter = paintWallBags;
  parts = [
    "stone",
    "wood",
    "iron",
    "ceramic",
    "leather",
    "sack-back",
    "sack-front",
    "rope",
  ];
} else if (spec.material === "bed") {
  painter = makeBedPainter(spec);
  parts = ["stone", "wood", "cloth", "pillow", "straw"];
} else if (spec.material === "skull-pedestal") {
  painter = paintPedestal;
  parts = ["stone", "bone", "iron"];
} else if (spec.material === "bridge-bones") {
  painter = makeBridgePainter(code);
  parts = code === "UD-019" ? ["stone", "bone", "iron"] : ["stone", "bone"];
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
