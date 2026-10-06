// Package one checked revision; preserve the source and every placement field.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { localModelAsset } from "./local_model_assets.mjs";
const base = path.resolve(
  import.meta.dirname,
  "../../models/collections/majestic-highlands",
);
const directory = path.join(base, "optimized-review/MH-001");
const report = JSON.parse(
  await fs.readFile(path.join(directory, "report.json"), "utf8"),
);
const registry = JSON.parse(
  await fs.readFile(path.join(base, "registry-snapshot.json"), "utf8"),
);
const previous = registry.find(
  (m) => m.id === (report.previousModelID ?? report.model.id),
);
if (
  !previous ||
  previous.sourceCode !== "MH-001" ||
  previous.collection !== "majestic-highlands"
)
  throw new Error("Reviewed published source required");
const latest = Math.max(
  ...registry
    .filter(
      (m) =>
        m.collection === previous.collection &&
        m.sourceCode === previous.sourceCode,
    )
    .map((m) => m.version),
);
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const sharp = require("sharp");
await sharp(path.join(directory, "preview.png"))
  .resize(512, 512)
  .webp({ quality: 90 })
  .toFile(path.join(directory, "preview.webp"));
const upload = path.join(base, "optimized-upload/MH-001");
await fs.mkdir(upload, { recursive: true });
const assets = {};
for (const [kind, file, mime] of [
  ["render", path.join(directory, "render.glb"), "model/gltf-binary"],
  ["lod", path.join(directory, "lod.glb"), "model/gltf-binary"],
  ["preview", path.join(directory, "preview.webp"), "image/webp"],
  ["source", await localModelAsset(previous.assets.source), "model/stl"],
]) {
  const bytes = await fs.readFile(file),
    sha256 = createHash("sha256").update(bytes).digest("hex");
  const ext = path.extname(file),
    name = sha256 + ext;
  if (
    bytes.length >
    (kind === "source" ? 256 : kind === "preview" ? 4 : 32) * 1048576
  )
    throw new Error("MCP size limit exceeded");
  if (kind === "source" && sha256 !== previous.assets.source.sha256)
    throw new Error("Original source changed");
  await fs.link(file, path.join(upload, name)).catch((e) => {
    if (e.code !== "EEXIST") throw e;
  });
  assets[kind] =
    kind === "source"
      ? previous.assets.source
      : {
          key: "map-models/" + name,
          sha256,
          size: bytes.length,
          mimeType: mime,
          fileName: kind + ext,
        };
}
const hash = createHash("sha256")
  .update(report.recipe + ":" + previous.id + ":" + JSON.stringify(assets))
  .digest();
hash[6] = (hash[6] & 15) | 128;
hash[8] = (hash[8] & 63) | 128;
const hex = hash.subarray(0, 16).toString("hex");
const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
const registered = registry.find((m) => m.id === id);
if (latest !== previous.version && registered?.version !== latest)
  throw new Error("A newer revision needs review");
const model = {
  ...previous,
  id,
  version: registered?.version ?? latest + 1,
  assets,
};
report.previousModelID = previous.id;
report.model = model;
await fs.writeFile(
  path.join(directory, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
await fs.writeFile(
  path.join(upload, "catalogue.json"),
  JSON.stringify([model], null, 2) + "\n",
);
console.log(
  "MAJESTIC_KTX_MANIFEST",
  model.sourceCode,
  model.version,
  model.id,
  report.tiers,
);
