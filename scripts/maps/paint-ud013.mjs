import fs from "node:fs/promises";
import path from "node:path";
import { prepareSurfaceRevision } from "./prepare-surface-revision.mjs";
import { makeSkullPainter, SKULL_RECIPE } from "./ud013_material.mjs";
import { paintFloorJoint } from "./floor_seams.mjs";
const reference = JSON.parse(
  await fs.readFile(
    path.resolve(
      import.meta.dirname,
      "../../models/collections/ud013-floor.json",
    ),
    "utf8",
  ),
);
const wallDir = path.resolve(
  import.meta.dirname,
  "../../models/collections/ud013-wall-reference",
);
const wallReference = {
  spec: JSON.parse(
    await fs.readFile(path.join(wallDir, "reference.json"), "utf8"),
  ),
  x: await fs.readFile(path.join(wallDir, "x.bin")),
  y: await fs.readFile(path.join(wallDir, "y.bin")),
};
const painter = makeSkullPainter(reference, wallReference);
await prepareSurfaceRevision({
  code: "UD-013",
  folder: "ud013-aged-bones",
  recipe: SKULL_RECIPE,
  paintPixel: (rgb, p, n, ao) => {
    const painted = painter(rgb, p, n, ao);
    if (painted.part === "stone")
      painted.rgb = paintFloorJoint(
        painted.rgb,
        p,
        n,
        11.5,
        [17.5, 17.5],
        ao,
      ).rgb;
    return painted;
  },
  parts: ["stone", "bone"],
  colorReferenceVersion: 3,
  sampleAO: true,
});
