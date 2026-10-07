// A second lighter option: retain geometry/UV, reduce all atlases and normalize normals.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { readGlb, embeddedImage, replaceImages } from "./glb_textures.mjs";
import { rasterizeSurface } from "./uv_surface.mjs";
const file = process.argv[2];
if (!file) throw Error("One Toxic Sewer report required");
const directory = path.dirname(path.resolve(file));
const report = JSON.parse(await fs.readFile(file, "utf8"));
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const sharp = require("sharp");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { dequantize } = require("@gltf-transform/functions");
const { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const sizes = [
  report.rebake.render.bakeSize / 2,
  report.rebake.lod.bakeSize / 2,
];
const name = `maps-${sizes[0]}-${sizes[1]}-roughness4`;
const output = path.join(directory, "candidates", name);
await fs.mkdir(output, { recursive: true });
const next = structuredClone(report);
next.optimization = {
  candidate: name,
  geometry: "byte-exact",
  maps: "Half-resolution PNG; tangent normal vectors renormalized; roughness step 4/255",
  baseline: report.tiers,
  selection: "pending visual comparison",
};
for (const [tierIndex, tier] of ["render", "lod"].entries()) {
  const size = sizes[tierIndex];
  const glb = readGlb(await fs.readFile(path.join(directory, tier + ".glb")));
  const replacements = new Map();
  for (const material of glb.json.materials) {
    const pbr = material.pbrMetallicRoughness;
    for (const [role, texture] of [
      ["colour", pbr?.baseColorTexture],
      ["normal", material.normalTexture],
      ["orm", pbr?.metallicRoughnessTexture],
    ]) {
      if (!texture) continue;
      const image = glb.json.textures[texture.index].source;
      const { data, info } = await sharp(embeddedImage(glb, image))
        .resize(size, size)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      if (info.channels !== 3) throw Error("Expected RGB PBR atlas");
      if (role === "normal")
        for (let i = 0; i < data.length; i += 3) {
          const n = [
            data[i] / 127.5 - 1,
            data[i + 1] / 127.5 - 1,
            Math.max(0.01, data[i + 2] / 127.5 - 1),
          ];
          const length = Math.hypot(...n);
          for (let j = 0; j < 3; j++)
            data[i + j] = Math.round((n[j] / length + 1) * 127.5);
        }
      if (role === "orm")
        for (let i = 1; i < data.length; i += 3)
          data[i] = Math.min(255, Math.round(data[i] / 4) * 4);
      replacements.set(
        image,
        await sharp(data, { raw: info })
          .png({ compressionLevel: 9 })
          .toBuffer(),
      );
    }
  }
  const bytes = replaceImages(glb, replacements);
  await fs.writeFile(path.join(output, tier + ".glb"), bytes);
  const doc = await io.readBinary(bytes);
  await doc.transform(dequantize());
  const textured = doc
    .getRoot()
    .listMaterials()
    .filter((m) => m.getBaseColorTexture());
  if (textured.length !== 1) throw Error("One baked body material expected");
  const colour = await sharp(
    Buffer.from(textured[0].getBaseColorTexture().getImage()),
  )
    .raw()
    .toBuffer();
  const normal = await sharp(
    Buffer.from(textured[0].getNormalTexture().getImage()),
  )
    .raw()
    .toBuffer();
  let black = 0,
    invalid = 0;
  const coverage = rasterizeSurface(doc, size, size, (i) => {
    if (Math.max(...colour.subarray(i * 3, i * 3 + 3)) < 4) black++;
    if (normal[i * 3 + 2] < 128) invalid++;
  });
  if (black || invalid)
    throw Error(
      `Decoded map defects: ${black} black / ${invalid} invalid normal pixels`,
    );
  for (const extension of doc.getRoot().listExtensionsUsed())
    if (extension.extensionName === "EXT_meshopt_compression")
      extension.dispose();
  await io.write(
    path.join(
      output,
      tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
    ),
    doc,
  );
  next.tiers[tier] = {
    ...report.tiers[tier],
    textureSize: size,
    bytes: bytes.length,
    usedUvPixels: coverage.reduce((a, b) => a + b, 0),
    blackSurfacePixels: black,
    invalidNormalPixels: invalid,
  };
  console.log("SEWER_MAP_CANDIDATE", tier, size, bytes.length);
}
await fs.writeFile(
  path.join(output, "report.json"),
  JSON.stringify(next, null, 2) + "\n",
);
console.log("REVIEW_CANDIDATE", output);
