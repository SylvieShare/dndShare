import { currentModel } from "./current_model.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections/simple-pegs"),
  out = path.join(base, "upload");
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = require("sharp");
await fs.mkdir(out, { recursive: true });
const registry = JSON.parse(
  await fs.readFile(
    path.join(root, "models/collections/registry.json"),
    "utf8",
  ),
);
const models = [];
for (const item of (await fs.readdir(base, { withFileTypes: true })).sort(
  (a, b) => a.name.localeCompare(b.name),
)) {
  if (!item.isDirectory() || item.name === "upload") continue;
  const directory = path.join(base, item.name),
    report = JSON.parse(
      await fs.readFile(path.join(directory, "report.json"), "utf8"),
    );
  const temp = path.join(directory, "preview-next.webp");
  await sharp(path.join(directory, "preview.png"))
    .webp({ quality: 88 })
    .toFile(temp);
  await fs.rename(temp, path.join(directory, "preview.webp"));
  const assets = { source: report.model.assets.source };
  for (const kind of ["render", "lod", "preview"]) {
    const extension = kind === "preview" ? "webp" : "glb",
      fileName = `${kind}.${extension}`,
      file = path.join(directory, fileName),
      bytes = await fs.readFile(file),
      sha256 = createHash("sha256").update(bytes).digest("hex"),
      name = `${sha256}.${extension}`;
    if (bytes.length > (kind === "preview" ? 4 : 32) * 1048576)
      throw new Error("Asset exceeds server limit");
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
  const sourceName = path.basename(assets.source.key),
    source = path.join(root, "models/collections/upload", sourceName);
  await fs.link(source, path.join(out, sourceName)).catch((e) => {
    if (e.code !== "EEXIST") throw e;
  });
  models.push(currentModel(report.model, registry, assets));
}
await fs.writeFile(
  path.join(out, "catalogue.json"),
  JSON.stringify(models, null, 2) + "\n",
);
console.log("SIMPLE_PEG_MANIFEST", models.length);
