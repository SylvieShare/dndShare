// Check the exact invariants needed for existing maps to use a visual revision.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readGlb, embeddedImage } from "./glb_textures.mjs";
const base = path.resolve(import.meta.dirname, "../../models/collections");
const revisions = path.resolve(
  base,
  process.argv.find((a) => a.startsWith("--base="))?.slice(7) ||
    "stone-dungeon",
);
const allowRoughness = process.argv.includes("--roughness");
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = require("sharp");
async function source(asset) {
  for (const folder of [
    "stone-dungeon/upload",
    "simple-pegs/upload",
    "painted/upload",
    "upload",
  ]) {
    const file = path.join(base, folder, path.basename(asset.key));
    if (await fs.stat(file).catch(() => null)) return file;
  }
  throw new Error("Missing original " + asset.sha256);
}
let models = 0,
  tiers = 0,
  views = 0;
for (const entry of await fs.readdir(revisions, {
  withFileTypes: true,
})) {
  if (!entry.isDirectory() || entry.name === "upload") continue;
  const directory = path.join(revisions, entry.name);
  const report = JSON.parse(
    await fs.readFile(path.join(directory, "report.json"), "utf8"),
  );
  for (const tier of ["render", "lod"]) {
    const before = readGlb(
      await fs.readFile(await source(report.model.assets[tier])),
    );
    const after = readGlb(
      await fs.readFile(path.join(directory, `${tier}.glb`)),
    );
    for (const key of [
      "nodes",
      "meshes",
      "accessors",
      "scenes",
      "textures",
      "images",
      "extensionsUsed",
      "extensionsRequired",
    ])
      assert.deepEqual(
        after.json[key],
        before.json[key],
        `${entry.name}: ${key} changed`,
      );
    const baseImages = new Set(
      before.json.materials.flatMap((m) => {
        const index = m.pbrMetallicRoughness?.baseColorTexture?.index;
        return index === undefined ? [] : [before.json.textures[index].source];
      }),
    );
    const imageViews = new Set(before.json.images.map((i) => i.bufferView));
    const ormImages = new Set(
      before.json.materials.flatMap((m) => {
        const index = m.pbrMetallicRoughness?.metallicRoughnessTexture?.index;
        return index === undefined ? [] : [before.json.textures[index].source];
      }),
    );
    for (let i = 0; i < before.json.images.length; i++)
      if (allowRoughness && ormImages.has(i)) {
        const a = await sharp(embeddedImage(before, i))
            .raw()
            .toBuffer({ resolveWithObject: true }),
          b = await sharp(embeddedImage(after, i))
            .raw()
            .toBuffer({ resolveWithObject: true });
        assert.deepEqual(a.info, b.info, "ORM layout changed");
        for (let p = 0; p < a.data.length; p++)
          if (p % a.info.channels !== 1)
            assert.equal(b.data[p], a.data[p], "AO/metallic channel changed");
      } else if (!baseImages.has(i))
        assert.deepEqual(
          embeddedImage(after, i),
          embeddedImage(before, i),
          "Normal/ORM bytes changed",
        );
    assert.equal(after.json.bufferViews.length, before.json.bufferViews.length);
    for (let i = 0; i < before.json.bufferViews.length; i++) {
      if (imageViews.has(i)) continue;
      const a = before.json.bufferViews[i],
        b = after.json.bufferViews[i];
      const ca = a.extensions?.EXT_meshopt_compression,
        cb = b.extensions?.EXT_meshopt_compression;
      assert.equal(b.byteLength, a.byteLength);
      if (ca?.buffer === 0) {
        assert.deepEqual(
          after.bin.subarray(cb.byteOffset, cb.byteOffset + cb.byteLength),
          before.bin.subarray(ca.byteOffset, ca.byteOffset + ca.byteLength),
          "Compressed mesh bytes changed",
        );
        const { byteOffset: unusedA, ...propsA } = ca,
          { byteOffset: unusedB, ...propsB } = cb;
        assert.deepEqual(propsA, propsB, "Meshopt format changed");
      } else if (a.buffer === 0) {
        assert.deepEqual(
          after.bin.subarray(
            b.byteOffset || 0,
            (b.byteOffset || 0) + b.byteLength,
          ),
          before.bin.subarray(
            a.byteOffset || 0,
            (a.byteOffset || 0) + a.byteLength,
          ),
          "Uncompressed mesh bytes changed",
        );
      }
      views++;
    }
    before.json.materials.forEach((m, i) => {
      if (m.name !== "Simple insertion pegs")
        assert.deepEqual(
          after.json.materials[i],
          m,
          "Surface material changed",
        );
    });
    tiers++;
  }
  models++;
}
console.log("MASONRY_VALIDATED", { models, tiers, geometryViews: views });
