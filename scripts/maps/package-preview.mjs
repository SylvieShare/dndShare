import { currentModel } from "./current_model.mjs";
// Publish a preview-only revision, reusing all verified geometry resources.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { transparentPreview } from "./preview_image.mjs";
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
const original = variants[0];
const checksum = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (checksum(await fs.readFile(reference)) !== original.assets.render.sha256)
  throw new Error(
    "Preview reference does not match the latest registered render asset",
  );
const image = await transparentPreview(preview);
const metadata = { width: image.width, height: image.height };
const transparent = image.transparentPixels,
  solid = image.opaquePixels;
await fs.mkdir(output, { recursive: true });
const bytes = image.bytes;
const sha256 = checksum(bytes),
  fileName = sha256 + ".webp";
await fs.writeFile(path.join(output, fileName), bytes);
const model = currentModel(
  original,
  catalogue,
  structuredClone(original.assets),
);
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

    bytes: bytes.length,
    hasAlpha: true,
    width: metadata.width,
    height: metadata.height,
  }),
);
