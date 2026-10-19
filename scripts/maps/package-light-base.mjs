import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { lightBaseDirectory } from "./light_base_context.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = require("sharp"),
  code = process.argv[2];
const root = path.resolve(import.meta.dirname, "../.."),
  directory = lightBaseDirectory(code),
  report = JSON.parse(
    await fs.readFile(path.join(directory, "report.json"), "utf8"),
  );
const input = await fs.readFile(
    path.join(directory, "transparent-preview.png"),
  ),
  { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
assert.ok(
  info.channels === 4 && [...data].some((v, i) => i % 4 === 3 && v === 255),
  "Empty preview",
);
for (let x = 0; x < info.width; x++)
  for (const y of [0, info.height - 1])
    assert.equal(data[(y * info.width + x) * 4 + 3], 0, "Preview clipped");
for (let y = 0; y < info.height; y++)
  for (const x of [0, info.width - 1])
    assert.equal(data[(y * info.width + x) * 4 + 3], 0, "Preview clipped");
await fs.writeFile(
  path.join(directory, "preview.webp"),
  await sharp(input).webp({ quality: 92, alphaQuality: 100 }).toBuffer(),
);
const assets = { ...report.model.assets },
  folder = path.join(directory, "upload");
await fs.mkdir(folder, { recursive: true });
for (const role of ["render", "lod", "shadow", "preview"]) {
  const ext = role === "preview" ? ".webp" : ".glb",
    bytes = await fs.readFile(path.join(directory, role + ext)),
    sha256 = createHash("sha256").update(bytes).digest("hex");
  await fs.writeFile(path.join(folder, sha256 + ext), bytes);
  assets[role] = {
    key: "map-models/" + sha256 + ext,
    sha256,
    size: bytes.length,
    mimeType: role === "preview" ? "image/webp" : "model/gltf-binary",
    fileName: role + ext,
  };
}
const source = await fs.readFile(
  report.sourcePath
    ? path.isAbsolute(report.sourcePath)
      ? report.sourcePath
      : path.join(root, "models", report.sourcePath)
    : await localModelAsset(assets.source),
);
assert.equal(
  createHash("sha256").update(source).digest("hex"),
  assets.source.sha256,
);
await fs.writeFile(path.join(folder, assets.source.sha256 + ".stl"), source);
const model = { ...report.model, assets };
await fs.writeFile(
  path.join(folder, "catalogue.json"),
  JSON.stringify([model], null, 2) + "\n",
);
report.model = model;
report.runtimeBytes = Object.entries(assets)
  .filter(([role]) => role !== "source")
  .reduce((n, [, asset]) => n + asset.size, 0);
await fs.writeFile(
  path.join(directory, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log("LIGHT_BASE_PACKAGED", code, report.runtimeBytes);
