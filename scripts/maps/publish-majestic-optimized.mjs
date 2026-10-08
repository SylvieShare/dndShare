import { currentModel } from "./current_model.mjs";
// Package one checked revision; preserve the source and every placement field.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { localModelAsset } from "./local_model_assets.mjs";
import { prepareShadow } from "./shadow_model.mjs";
import { transparentPreview } from "./preview_image.mjs";
import { isDeepStrictEqual } from "node:util";
const base = path.resolve(
  import.meta.dirname,
  "../../models/collections/majestic-highlands",
);
const code =
  process.argv.find((a) => a.startsWith("--code="))?.slice(7) ?? "MH-001";
const root = path.resolve(import.meta.dirname, "../..");
const directory = path.join(base, "optimized-review", code);
const report = JSON.parse(
  await fs.readFile(path.join(directory, "report.json"), "utf8"),
);
const registry = JSON.parse(
  await fs.readFile(path.join(base, "registry-snapshot.json"), "utf8"),
);
const reviewed = report.model;
if (
  reviewed.sourceCode !== code ||
  reviewed.collection !== "majestic-highlands"
)
  throw new Error("Individually reviewed Majestic model required");
const sourceSHA = report.sourceSHA256 ?? reviewed.assets.source.sha256;
const family = registry.filter(
  (m) =>
    m.collection === reviewed.collection &&
    m.sourceCode === reviewed.sourceCode &&
    m.sourceName === reviewed.sourceName &&
    m.assets.source.sha256 === sourceSHA,
);
const previous = family[0];
const current = registry.find(
  (m) =>
    m.collection === reviewed.collection &&
    m.sourceCode === reviewed.sourceCode &&
    m.sourceName === reviewed.sourceName,
);
const newSource = !previous && !!current;
if (newSource && !process.argv.includes("--new-source"))
  throw new Error(
    "Existing code has a different source; review the replacement and pass --new-source explicitly",
  );
function placement(model) {
  const { id, assets, textureDetail, code, ...metadata } = model;
  return metadata;
}
if (previous && !isDeepStrictEqual(placement(previous), placement(reviewed)))
  throw new Error("Placement changed after review");
if (previous && reviewed.assets)
  for (const kind of ["render", "lod"])
    if (previous.assets[kind].sha256 !== reviewed.assets[kind].sha256)
      throw new Error("Newer visual assets need review before packaging");
if (!previous && report.reviewStatus !== "accepted")
  throw new Error("Inspect final render and LOD before publication");
const sourceFile = previous
  ? await localModelAsset(previous.assets.source)
  : path.join(root, "models", report.sourcePath);
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const sharp = require("sharp");
await sharp(path.join(directory, "preview.png"))
  .resize(512, 512)
  .png()
  .toFile(path.join(directory, "catalogue-preview.png"));
const preview = await transparentPreview(
  path.join(directory, "catalogue-preview.png"),
);
await fs.writeFile(path.join(directory, "preview-next.webp"), preview.bytes);
await fs.rename(
  path.join(directory, "preview-next.webp"),
  path.join(directory, "preview.webp"),
);
const upload = path.join(base, "optimized-upload", code);
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
  ["source", sourceFile, "model/stl"],
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
  if (kind === "source" && sha256 !== sourceSHA)
    throw new Error("Original source changed");
  await fs.link(file, path.join(upload, name)).catch((e) => {
    if (e.code !== "EEXIST") throw e;
  });
  assets[kind] =
    kind === "source" && previous
      ? previous.assets.source
      : {
          key: "map-models/" + name,
          sha256,
          size: bytes.length,
          mimeType: mime,
          fileName: kind === "source" ? path.basename(sourceFile) : kind + ext,
        };
}
report.runtimeBytes = [
  ...new Map(
    Object.entries(assets)
      .filter(([kind]) => kind !== "source")
      .map(([, asset]) => [asset.sha256, asset.size]),
  ).values(),
].reduce((sum, bytes) => sum + bytes, 0);
const model = currentModel(reviewed, registry, assets);
if (previous) report.previousModelID = previous.id;
if (newSource)
  report.sourceReplacement = {
    reason: report.sourceNote ?? "Reviewed canonical source correction",
    replaces: registry
      .filter(
        (m) =>
          m.collection === model.collection &&
          m.sourceCode === model.sourceCode,
      )
      .map((m) => m.id),
    compatibleVisualRevision: false,
  };
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
  model.assets.render.sha256.slice(0, 12),
  model.id,
  report.tiers,
);
