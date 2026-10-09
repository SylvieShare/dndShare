import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { localModelAsset } from "./local_model_assets.mjs";
import { fitCavePegs } from "./fitted_cave_pegs.mjs";
import { writeBlenderPreview } from "./review_glb_preview.mjs";
import { readGlb } from "./glb_textures.mjs";
import { textureDimensions } from "./texture_dimensions.mjs";
const code = process.argv[2];
if (!/^LC-\d{3}$/.test(code ?? ""))
  throw new Error("One reviewed Lost Cave code required");
const base = path.resolve(
  import.meta.dirname,
  "../../models/collections/lost-cave",
);
const registry = JSON.parse(
  await fs.readFile(path.join(base, "registry-snapshot.json"), "utf8"),
);
const model = registry.find((m) => m.sourceCode === code);
if (!model || model.textureDetail !== "detailed")
  throw new Error(
    "Read and confirm the individually detailed current model first",
  );
const directory = path.join(
  base,
  "peg-fit",
  code,
  `${code}__${model.sourceName.replace(/[^a-z0-9]+/gi, "_")}__${model.assets.render.sha256.slice(0, 12)}`,
);
await fs.mkdir(directory, { recursive: true });
const report = {
  model,
  originalModel: structuredClone(model),
  recipe: "lost-cave-peg-fit-v1",
  insertionProfile: {
    topWidthMM: 34.3,
    bottomWidthMM: 22.75,
    bodyAndAtlases: "original byte buffers retained",
  },
  tiers: {},
};
for (const tier of ["render", "lod"]) {
  const before = await fs.readFile(await localModelAsset(model.assets[tier]));
  if (
    before.length !== model.assets[tier].size ||
    createHash("sha256").update(before).digest("hex") !==
      model.assets[tier].sha256
  )
    throw new Error("Original current asset checksum differs");
  const result = await fitCavePegs(before, model);
  if (result.unchanged)
    throw new Error("No existing simplified insertion geometry to repair");
  const a = readGlb(before),
    b = readGlb(result.bytes);
  assert.deepEqual(
    b.bin.subarray(0, a.json.buffers[0].byteLength),
    a.bin.subarray(0, a.json.buffers[0].byteLength),
  );
  for (const field of ["materials", "textures", "images"])
    assert.deepEqual(
      b.json[field],
      a.json[field],
      "Original shading resources changed",
    );
  assert.deepEqual(
    b.json.accessors.slice(0, a.json.accessors.length),
    a.json.accessors,
  );
  assert.deepEqual(
    b.json.bufferViews.slice(0, a.json.bufferViews.length),
    a.json.bufferViews,
  );
  const texture = b.json.materials.find(
    (m) => m.pbrMetallicRoughness?.baseColorTexture,
  ).pbrMetallicRoughness.baseColorTexture.index;
  const image =
    b.json.images[
      b.json.textures[texture].extensions?.KHR_texture_basisu?.source ??
        b.json.textures[texture].source
    ];
  const view = b.json.bufferViews[image.bufferView];
  const dimensions = await textureDimensions(
    b.bin.subarray(
      view.byteOffset ?? 0,
      (view.byteOffset ?? 0) + view.byteLength,
    ),
    image.mimeType,
  );
  report.tiers[tier] = {
    beforeBytes: before.length,
    bytes: result.bytes.length,
    textureSize: dimensions.width,
    pads: result.pads.length,
    bodyAndTexturesUnchanged: true,
  };
  await fs.writeFile(path.join(directory, tier + ".glb"), result.bytes);
  await writeBlenderPreview(before, path.join(directory, tier + "-input.glb"));
  await writeBlenderPreview(
    result.bytes,
    path.join(
      directory,
      tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
    ),
  );
}
await fs.writeFile(
  path.join(directory, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log("FITTED_CAVE_PEGS", code, directory, report.tiers);
