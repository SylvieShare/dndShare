// Publish a preview-only revision, reusing all verified geometry resources.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const sharp = createRequire("/private/tmp/dndshare-model-tools/package.json")(
  "sharp",
);
const argument = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const collection = argument("collection"),
  code = argument("code"),
  sourceName = argument("source-name");
const snapshot = argument("snapshot"),
  preview = argument("preview"),
  reference = argument("reference-glb"),
  output = argument("output");
if (!collection || !code || !snapshot || !preview || !reference || !output)
  throw new Error(
    "collection, code, snapshot, preview, reference-glb and output are required",
  );
const catalogue = JSON.parse(await fs.readFile(snapshot, "utf8"));
const variants = catalogue.filter(
  (m) =>
    m.collection === collection &&
    m.sourceCode === code &&
    (!sourceName || m.sourceName === sourceName),
);
if (!variants.length || new Set(variants.map((m) => m.sourceName)).size !== 1)
  throw new Error("Select exactly one registered source variant");
const original = variants.sort((a, b) => b.version - a.version)[0];
const checksum = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (checksum(await fs.readFile(reference)) !== original.assets.render.sha256)
  throw new Error(
    "Preview reference does not match the latest registered render asset",
  );
const metadata = await sharp(preview).metadata();
if (!metadata.hasAlpha || metadata.width !== metadata.height)
  throw new Error("A square image with alpha is required");
const rgba = await sharp(preview).ensureAlpha().raw().toBuffer();
let transparent = 0,
  solid = 0;
for (let i = 3; i < rgba.length; i += 4) {
  if (rgba[i] === 0) transparent++;
  if (rgba[i] === 255) solid++;
}
if (!transparent || !solid)
  throw new Error(
    "Preview must contain transparent background and opaque model pixels",
  );
await fs.mkdir(output, { recursive: true });
const bytes = await sharp(preview)
  .webp({ quality: 88, alphaQuality: 100 })
  .toBuffer();
const sha256 = checksum(bytes),
  fileName = sha256 + ".webp";
await fs.writeFile(path.join(output, fileName), bytes);
const model = structuredClone(original);
model.id = randomUUID();
model.version =
  Math.max(
    ...catalogue
      .filter((m) => m.collection === collection && m.sourceCode === code)
      .map((m) => m.version),
  ) + 1;
model.assets.preview = {
  key: `map-models/${fileName}`,
  sha256,
  size: bytes.length,
  mimeType: "image/webp",
  fileName: "preview.webp",
};
await fs.writeFile(
  path.join(output, "catalogue.json"),
  JSON.stringify([model], null, 2) + "\n",
);
await fs.writeFile(
  path.join(output, "preview-report.json"),
  JSON.stringify(
    {
      previousId: original.id,
      id: model.id,
      code,
      version: model.version,
      width: metadata.width,
      height: metadata.height,
      transparentPixels: transparent,
      opaquePixels: solid,
      preview: model.assets.preview,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    code,
    version: model.version,
    bytes: bytes.length,
    hasAlpha: true,
    width: metadata.width,
    height: metadata.height,
  }),
);
