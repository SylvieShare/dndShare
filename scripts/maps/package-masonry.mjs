import { currentModel } from "./current_model.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { MASONRY_REVISION } from "./masonry_palette.mjs";
import { requestedCollection } from "./review_collection.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
import {
  includePreparedVariant,
  preservedRevisionAssets,
} from "./prepared_revision.mjs";
const root = path.resolve(import.meta.dirname, "../.."),
  base = path.resolve(
    root,
    process.argv.find((a) => a.startsWith("--base="))?.slice(7) ||
      "models/collections/stone-dungeon",
  ),
  out = path.join(base, "upload");
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = require("sharp");
const review = requestedCollection();
const registry = JSON.parse(await fs.readFile(review.snapshot, "utf8"));
await fs.mkdir(out, { recursive: true });
const models = [];
const included = new Set();
const recipe =
  process.argv.find((a) => a.startsWith("--recipe="))?.slice(9) ||
  MASONRY_REVISION;
for (const entry of (await fs.readdir(base, { withFileTypes: true })).sort(
  (a, b) => a.name.localeCompare(b.name),
)) {
  if (!entry.isDirectory() || entry.name === "upload") continue;
  const directory = path.join(base, entry.name);
  const report = JSON.parse(
    await fs.readFile(path.join(directory, "report.json"), "utf8"),
  );
  const requestedName = process.argv
    .find((a) => a.startsWith("--source-name="))
    ?.slice(14);
  if (requestedName && report.model.sourceName !== requestedName) continue;
  includePreparedVariant(included, report.model);
  if (report.model.collection !== review.collection)
    throw new Error("Prepared report belongs to another collection");
  if (report.recipe !== recipe) throw new Error("Unexpected colour recipe");
  if (
    report.geometryCorrection &&
    !process.argv.includes("--geometry-correction")
  )
    throw new Error(
      "Explicit incompatible geometry correction required before packaging",
    );
  const temporary = path.join(directory, "preview-next.webp");
  await sharp(path.join(directory, "preview.png"))
    .webp({ quality: 88 })
    .toFile(temporary);
  await fs.rename(temporary, path.join(directory, "preview.webp"));
  const assets = preservedRevisionAssets(report.model, report.preparedShadow);
  if (report.preparedShadow) {
    const shadowName = path.basename(assets.shadow.key);
    await fs
      .link(path.join(directory, shadowName), path.join(out, shadowName))
      .catch((e) => {
        if (e.code !== "EEXIST") throw e;
      });
  }
  const sourceName = path.basename(assets.source.key);
  await fs
    .link(await localModelAsset(assets.source), path.join(out, sourceName))
    .catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
  for (const kind of ["render", "lod", "preview"]) {
    const extension = kind === "preview" ? "webp" : "glb",
      fileName = `${kind}.${extension}`;
    const file = path.join(directory, fileName),
      bytes = await fs.readFile(file);
    if (bytes.length > (kind === "preview" ? 4 : 32) * 1048576)
      throw new Error("Asset exceeds server limit");
    const sha256 = createHash("sha256").update(bytes).digest("hex"),
      name = `${sha256}.${extension}`;
    await fs.link(file, path.join(out, name)).catch((e) => {
      if (e.code !== "EEXIST") throw e;
    });
    assets[kind] = {
      key: `map-models/${name}`,
      sha256,
      size: bytes.length,
      mimeType: kind === "preview" ? "image/webp" : "model/gltf-binary",
      fileName,
    };
  }
  const detailedRecipe = [
    "ud006-measured-timber-v1",
    "ud009-layered-stone-v1",
    "ud010-measured-door-v1",
  ].includes(recipe);
  const textureDetail = detailedRecipe
    ? "detailed"
    : report.model.textureDetail || "basic";
  models.push(
    currentModel({ ...report.model, textureDetail }, registry, assets),
  );
}
await fs.writeFile(
  path.join(out, "catalogue.json"),
  JSON.stringify(models, null, 2) + "\n",
);
console.log(
  "MASONRY_MANIFEST",
  models.length,
  "render MiB",
  models.reduce((n, m) => n + m.assets.render.size, 0) / 1048576,
);
