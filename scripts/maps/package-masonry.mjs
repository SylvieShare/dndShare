import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { MASONRY_REVISION } from "./masonry_palette.mjs";
const root = path.resolve(import.meta.dirname, "../.."),
  base = path.resolve(
    root,
    process.argv.find((a) => a.startsWith("--base="))?.slice(7) ||
      "models/collections/stone-dungeon",
  ),
  out = path.join(base, "upload");
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = require("sharp");
const registry = JSON.parse(
  await fs.readFile(
    path.join(root, "models/collections/registry.json"),
    "utf8",
  ),
);
const versions = new Map();
for (const m of registry) {
  const key = `${m.collection}:${m.sourceCode}`;
  versions.set(key, Math.max(versions.get(key) || 0, m.version));
}
await fs.mkdir(out, { recursive: true });
const models = [];
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
  if (report.recipe !== recipe) throw new Error("Unexpected colour recipe");
  const temporary = path.join(directory, "preview-next.webp");
  await sharp(path.join(directory, "preview.png"))
    .webp({ quality: 88 })
    .toFile(temporary);
  await fs.rename(temporary, path.join(directory, "preview.webp"));
  const assets = { source: report.model.assets.source };
  const sourceName = path.basename(assets.source.key);
  await fs
    .link(
      path.join(root, "models/collections/upload", sourceName),
      path.join(out, sourceName),
    )
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
  const identity = createHash("sha256")
    .update(`${recipe}:${report.model.id}:${JSON.stringify(assets)}`)
    .digest();
  identity[6] = (identity[6] & 15) | 128;
  identity[8] = (identity[8] & 63) | 128;
  const hex = identity.subarray(0, 16).toString("hex"),
    id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const key = `${report.model.collection}:${report.model.sourceCode}`,
    version = versions.get(key) + 1;
  versions.set(key, version);
  const detailedRecipe = [
    "ud006-measured-timber-v1",
    "ud009-layered-stone-v1",
    "ud010-measured-door-v1",
  ].includes(recipe);
  const textureDetail = detailedRecipe
    ? "detailed"
    : report.model.textureDetail || "basic";
  models.push({ ...report.model, textureDetail, id, version, assets });
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
