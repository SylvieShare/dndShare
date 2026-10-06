// Package one checked revision; preserve the source and every placement field.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { localModelAsset } from "./local_model_assets.mjs";
import { prepareShadow } from "./shadow_model.mjs";
import { isDeepStrictEqual } from "node:util";
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
const reviewed = registry.find(
  (m) => m.id === (report.previousModelID ?? report.model.id),
);
if (
  !reviewed ||
  reviewed.sourceCode !== "MH-001" ||
  reviewed.collection !== "majestic-highlands"
)
  throw new Error("Reviewed published source required");
const family = registry
  .filter(
    (m) =>
      m.collection === reviewed.collection &&
      m.sourceCode === reviewed.sourceCode &&
      m.sourceName === reviewed.sourceName &&
      m.assets.source.sha256 === reviewed.assets.source.sha256,
  )
  .sort((a, b) => b.version - a.version);
const previous = family[0],
  latest = previous.version;
function placement(model) {
  const { id, version, assets, textureDetail, ...metadata } = model;
  return metadata;
}
if (!isDeepStrictEqual(placement(previous), placement(reviewed)))
  throw new Error("Placement changed after review");
for (const kind of ["render", "lod"])
  if (previous.assets[kind].sha256 !== report.model.assets[kind].sha256)
    throw new Error("Newer visual assets need review before packaging");
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const sharp = require("sharp");
await sharp(path.join(directory, "preview.png"))
  .resize(512, 512)
  .webp({ quality: 90 })
  .toFile(path.join(directory, "preview-next.webp"));
await fs.rename(
  path.join(directory, "preview-next.webp"),
  path.join(directory, "preview.webp"),
);
const upload = path.join(base, "optimized-upload/MH-001");
await fs.mkdir(upload, { recursive: true });
const assets = {};
const shadow = await prepareShadow(
  path.join(directory, "lod.glb"),
  path.join(directory, "shadow-next.glb"),
);
await fs.rename(
  path.join(directory, "shadow-next.glb"),
  path.join(directory, "shadow.glb"),
);
report.tiers.shadow = { triangles: shadow.triangles, bytes: shadow.asset.size };
for (const [kind, file, mime] of [
  ["render", path.join(directory, "render.glb"), "model/gltf-binary"],
  ["lod", path.join(directory, "lod.glb"), "model/gltf-binary"],
  ["shadow", path.join(directory, "shadow.glb"), "model/gltf-binary"],
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
report.runtimeBytes = [
  ...new Map(
    Object.entries(assets)
      .filter(([kind]) => kind !== "source")
      .map(([, asset]) => [asset.sha256, asset.size]),
  ).values(),
].reduce((sum, bytes) => sum + bytes, 0);
const hash = createHash("sha256")
  .update(report.recipe + ":" + previous.id + ":" + JSON.stringify(assets))
  .digest();
hash[6] = (hash[6] & 15) | 128;
hash[8] = (hash[8] & 63) | 128;
const hex = hash.subarray(0, 16).toString("hex");
const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
const registered = family.find(
  (m) =>
    isDeepStrictEqual(m.assets, assets) &&
    isDeepStrictEqual(placement(m), placement(previous)) &&
    m.textureDetail === previous.textureDetail,
);
const model = registered ?? {
  ...previous,
  id,
  version: latest + 1,
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
