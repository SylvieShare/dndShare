// Replace only baked albedo in the current GLBs, retaining every mesh/data byte.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readGlb, replaceImages } from "./glb_textures.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const code = process.argv[2];
if (!/^MH-\d{3}$/.test(code)) throw Error("One individually reviewed code required");
const base = path.resolve(import.meta.dirname, "../../models/collections/majestic-highlands"),
  history = path.join(base, "local-review-history", code + "-before-shore-height"),
  out = path.join(base, "optimized-review", code);
const report = JSON.parse(await fs.readFile(path.join(out, "report.json"), "utf8"));
function imageBytes(glb, index) {
  const view = glb.json.bufferViews[glb.json.images[index].bufferView];
  return glb.bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
}
function colourImages(glb) {
  return [...new Set(glb.json.materials.flatMap((material) => {
    const index = material.pbrMetallicRoughness?.baseColorTexture?.index;
    if (index === undefined) return [];
    return [glb.json.textures[index].extensions?.KHR_texture_basisu?.source
      ?? glb.json.textures[index].source];
  }))];
}
function surface(document) {
  const fingerprint = (accessor) => {
    const array = accessor.getArray();
    return { type: array.constructor.name, count: accessor.getCount(),
      hash: createHash("sha256").update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest("hex") };
  };
  return document.getRoot().listNodes().filter((node) => node.getMesh()).map((node) => ({
    name: node.getName(), matrix: node.getWorldMatrix(),
    primitives: node.getMesh().listPrimitives().map((primitive) => ({
      indices: fingerprint(primitive.getIndices()),
      attributes: Object.fromEntries(primitive.listSemantics().filter((name) => !name.startsWith("COLOR_")).map((name) =>
        [name, fingerprint(primitive.getAttribute(name))])),
    })),
  }));
}
for (const tier of ["render", "lod"]) {
  const beforePath = path.join(history, "optimized-review", tier + ".glb"),
    newPath = path.join(out, tier + ".glb");
  assert.deepEqual(surface(await io.read(beforePath)), surface(await io.read(newPath)),
    "Repaint changed geometry/UV/normal attributes");
  const before = readGlb(await fs.readFile(beforePath)),
    fresh = readGlb(await fs.readFile(newPath)),
    oldColour = colourImages(before), newColour = colourImages(fresh);
  assert.equal(oldColour.length, 1); assert.equal(newColour.length, 1);
  const replacement = replaceImages(before, new Map([[oldColour[0], imageBytes(fresh, newColour[0])]]));
  const verified = readGlb(replacement), original = readGlb(await fs.readFile(beforePath));
  for (let i = 0; i < original.json.bufferViews.length; i++) {
    if (i === original.json.images[oldColour[0]].bufferView) continue;
    for (const compressed of [false, true]) {
      const a = compressed ? original.json.bufferViews[i].extensions?.EXT_meshopt_compression : original.json.bufferViews[i];
      const b = compressed ? verified.json.bufferViews[i].extensions?.EXT_meshopt_compression : verified.json.bufferViews[i];
      if (!a || a.buffer !== 0) continue;
      assert(original.bin.subarray(a.byteOffset || 0, (a.byteOffset || 0) + a.byteLength).equals(
        verified.bin.subarray(b.byteOffset || 0, (b.byteOffset || 0) + b.byteLength)),
        `Non-albedo bufferView ${i} changed (compressed=${compressed})`);
    }
  }
  await fs.writeFile(newPath + ".next", replacement); await fs.rename(newPath + ".next", newPath);
  report.tiers[tier].bytes = replacement.length;
  // Reuse the previous proxy geometry and its normal/ORM PNGs for visual review.
  const proxyName = tier === "render" ? "preview-model.glb" : "lod-preview-model.glb";
  const proxy = await io.read(path.join(history, "optimized-review", proxyName));
  const freshProxy = await io.read(path.join(out, proxyName));
  const material = proxy.getRoot().listMaterials().find((m) => m.getBaseColorTexture());
  const colour = freshProxy.getRoot().listMaterials().find((m) => m.getBaseColorTexture()).getBaseColorTexture();
  material.getBaseColorTexture().setImage(colour.getImage()).setMimeType("image/png");
  await io.write(path.join(out, proxyName + ".next.glb"), proxy);
  await fs.rename(path.join(out, proxyName + ".next.glb"), path.join(out, proxyName));
  console.log("MAJESTIC_REPAINT_BYTES_PRESERVED", code, tier, replacement.length);
}
report.repaintValidation = { geometryUVNormalsAndDataBytes: "unchanged", replacement: "albedo only" };
await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
