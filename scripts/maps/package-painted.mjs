import { currentModel } from "./current_model.mjs";
// Package painted GLBs and preserve the exact metadata/source of each revision.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "../..");
const base = path.join(root, "models/collections/painted/ultimate-dungeon");
const upload = path.join(root, "models/collections/painted/upload");
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const sharp = require("sharp");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { meshopt, simplify } = require("@gltf-transform/functions");
const {
  MeshoptEncoder,
  MeshoptDecoder,
  MeshoptSimplifier,
} = require("meshoptimizer");
await Promise.all([
  MeshoptEncoder.ready,
  MeshoptDecoder.ready,
  MeshoptSimplifier.ready,
]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
await fs.mkdir(upload, { recursive: true });
const originals = JSON.parse(
  await fs.readFile(
    path.join(root, "models/collections/upload/catalogue.json"),
    "utf8",
  ),
);
const models = [];
const codes = process.argv
  .find((arg) => arg.startsWith("--codes="))
  ?.slice(8)
  .split(",");
for (const folder of (await fs.readdir(base, { withFileTypes: true })).sort(
  (a, b) => a.name.localeCompare(b.name),
)) {
  if (!folder.isDirectory()) continue;
  if (
    codes &&
    !codes.some(
      (code) => folder.name === code || folder.name.startsWith(code + "__"),
    )
  )
    continue;
  const directory = path.join(base, folder.name);
  const row = JSON.parse(
    await fs.readFile(path.join(directory, "report.json"), "utf8"),
  );
  const original = originals.find(
    (m) =>
      m.collection === row.collection &&
      m.sourceCode === row.code &&
      m.sourceName === row.sourceName,
  );
  if (!original) throw new Error(`Missing original ${folder.name}`);
  const previewTemp = path.join(directory, "preview-next.webp");
  await sharp(path.join(directory, "preview.png"))
    .resize(256, 256, { fit: "inside" })
    .webp({ quality: 88 })
    .toFile(previewTemp);
  await fs.rename(previewTemp, path.join(directory, "preview.webp"));
  for (const tier of ["render", "lod"]) {
    if (await fs.stat(path.join(directory, `${tier}.glb`)).catch(() => null))
      continue;
    const doc = await io.read(path.join(directory, "model.glb"));
    for (const scene of doc.getRoot().listScenes())
      for (const node of scene.listChildren()) {
        const [x, y, z] = node.getTranslation();
        node.setTranslation([
          x - (row.min[0] + row.max[0]) / 70,
          y,
          z + (row.min[1] + row.max[1]) / 70,
        ]);
      }
    if (tier === "lod") {
      await doc.transform(
        simplify({ simplifier: MeshoptSimplifier, ratio: 0.25, error: 0.005 }),
      );
      const normalMaps = new Set(
        doc
          .getRoot()
          .listMaterials()
          .map((m) => m.getNormalTexture()),
      );
      for (const texture of doc.getRoot().listTextures()) {
        const { data, info } = await sharp(Buffer.from(texture.getImage()))
          .resize(512, 512)
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        if (normalMaps.has(texture)) {
          for (let i = 0; i < data.length; i += info.channels) {
            const x = data[i] / 127.5 - 1,
              y = data[i + 1] / 127.5 - 1,
              z = Math.max(0.01, data[i + 2] / 127.5 - 1);
            const length = Math.hypot(x, y, z);
            data[i] = Math.round((x / length + 1) * 127.5);
            data[i + 1] = Math.round((y / length + 1) * 127.5);
            data[i + 2] = Math.round((z / length + 1) * 127.5);
          }
        }
        const png = await sharp(data, { raw: info }).png().toBuffer();
        texture.setImage(png).setMimeType("image/png");
      }
    }
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
    const temporary = path.join(directory, `${tier}-next.glb`);
    await io.write(temporary, doc);
    await fs.rename(temporary, path.join(directory, `${tier}.glb`));
  }
  const assets = { source: original.assets.source };
  for (const [kind, extension, mimeType] of [
    ["render", "glb", "model/gltf-binary"],
    ["lod", "glb", "model/gltf-binary"],
    ["preview", "webp", "image/webp"],
  ]) {
    const fileName = `${kind}.${extension}`,
      file = path.join(directory, fileName);
    const bytes = await fs.readFile(file),
      sha256 = createHash("sha256").update(bytes).digest("hex");
    const assetName = `${sha256}.${extension}`;
    await fs.link(file, path.join(upload, assetName)).catch((e) => {
      if (e.code !== "EEXIST") throw e;
    });
    assets[kind] = {
      key: `map-models/${assetName}`,
      sha256,
      size: bytes.length,
      mimeType,
      fileName,
    };
  }
  await fs
    .link(
      path.join(
        root,
        "models/collections/upload",
        path.basename(assets.source.key),
      ),
      path.join(upload, path.basename(assets.source.key)),
    )
    .catch((e) => {
      if (e.code !== "EEXIST") throw e;
    });
  // The current UUID is independent of content-addressed asset keys.
  models.push(currentModel(original, originals, assets));
  console.log("PACKAGED_PAINT", folder.name, assets.render.size);
}
await fs.writeFile(
  path.join(upload, "catalogue.json"),
  JSON.stringify(models, null, 2) + "\n",
);
console.log("PAINT_MANIFEST", models.length);
