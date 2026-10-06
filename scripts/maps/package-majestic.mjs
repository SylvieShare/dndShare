// One reviewed tile; source bytes and derived assets stay in ignored models/.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections/majestic-highlands");
const code = process.argv.find((a) => a.startsWith("--code="))?.slice(7);
if (code !== "MH-001") throw new Error("Individually reviewed code required");
const directory = path.join(base, "prepared", code),
  review = path.join(base, "review", code);
const row = JSON.parse(
  await fs.readFile(path.join(directory, "report.json"), "utf8"),
);
if (row.width !== 3 || row.height !== 3 || row.placementPoints.length !== 9)
  throw new Error("Reviewed 3×3 footprint required");
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const sharp = require("sharp"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { meshopt, simplify } = require("@gltf-transform/functions"),
  {
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
await fs.mkdir(review, { recursive: true });
const tiers = {};
for (const tier of ["render", "lod"]) {
  const doc = await io.read(path.join(directory, "model.glb"));
  if (tier === "lod") {
    await doc.transform(
      simplify({ simplifier: MeshoptSimplifier, ratio: 0.25, error: 0.003 }),
    );
  }
  const normals = new Set(
    doc
      .getRoot()
      .listMaterials()
      .map((m) => m.getNormalTexture()),
  );
  const colours = new Set(
    doc
      .getRoot()
      .listMaterials()
      .map((m) => m.getBaseColorTexture()),
  );
  for (const texture of doc.getRoot().listTextures()) {
    const size = colours.has(texture)
      ? tier === "render"
        ? 2048
        : 1024
      : tier === "render"
        ? 1024
        : 512;
    const { data, info } = await sharp(Buffer.from(texture.getImage()))
      .resize(size, size)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (normals.has(texture))
      for (let i = 0; i < data.length; i += info.channels) {
        const n = [
            data[i] / 127.5 - 1,
            data[i + 1] / 127.5 - 1,
            Math.max(0.01, data[i + 2] / 127.5 - 1),
          ],
          length = Math.hypot(...n);
        for (let j = 0; j < 3; j++)
          data[i + j] = Math.round((n[j] / length + 1) * 127.5);
      }
    const image = sharp(data, { raw: info });
    texture
      .setImage(
        await (
          colours.has(texture)
            ? image.jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
            : image.png()
        ).toBuffer(),
      )
      .setMimeType(colours.has(texture) ? "image/jpeg" : "image/png");
  }
  const triangles = doc
    .getRoot()
    .listMeshes()
    .reduce(
      (s, m) =>
        s +
        m
          .listPrimitives()
          .reduce((n, p) => n + p.getIndices().getCount() / 3, 0),
      0,
    );
  if (tier === "render")
    await io.write(path.join(review, "preview-model.glb"), doc);
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await io.write(path.join(review, tier + ".glb"), doc);
  tiers[tier] = {
    triangles,
    bytes: (await fs.stat(path.join(review, tier + ".glb"))).size,
    textureSize: tier === "render" ? 2048 : 1024,
  };
}
const model = {
  collection: row.collection,
  collectionName: row.collectionName,
  sourceCode: code,
  sourceName: row.sourceName,
  name: row.sourceName,
  textureDetail: "detailed",
  tileType: "floor",
  hasDecor: false,
  canStand: true,
  hidden: false,
  placementPoints: row.placementPoints,
  wallMode: "none",
  wallMask: 0,
  width: 3,
  height: 3,
  placementOffset: [0, 0],
  mountDepth: row.mountDepth,
  surfaceHeight: row.surfaceHeight,
  maxHeight: row.maxHeight,
  blockers: [],
  tags: ["grass", "outdoor", "xl"],
  supportSlots: [],
};
const report = {
  model,
  recipe: "majestic-individual-materials-v1",
  tiers,
  quality: row.quality,
  sourcePath: row.sourcePath,
  sourceSHA256: row.sourceSHA256,
};
await fs.writeFile(
  path.join(review, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
if (!process.argv.includes("--publish-manifest")) {
  console.log("MAJESTIC_RUNTIME", code, tiers);
  process.exit(0);
}
const upload = path.join(base, "upload", code);
await fs.mkdir(upload, { recursive: true });
await sharp(path.join(review, "preview.png"))
  .webp({ quality: 90 })
  .toFile(path.join(review, "preview-next.webp"));
await fs.rename(
  path.join(review, "preview-next.webp"),
  path.join(review, "preview.webp"),
);
const assets = {};
for (const [kind, file, mime] of [
  ["render", path.join(review, "render.glb"), "model/gltf-binary"],
  ["lod", path.join(review, "lod.glb"), "model/gltf-binary"],
  ["preview", path.join(review, "preview.webp"), "image/webp"],
  ["source", path.join(root, "models", row.sourcePath), "model/stl"],
]) {
  const bytes = await fs.readFile(file),
    sha256 = createHash("sha256").update(bytes).digest("hex"),
    ext = path.extname(file),
    name = sha256 + ext;
  const limit = kind === "source" ? 256 : kind === "preview" ? 4 : 32;
  if (bytes.length > limit * 1048576)
    throw new Error("Asset exceeds MCP size limit");
  if (kind === "source" && sha256 !== row.sourceSHA256)
    throw new Error("Source changed after individual preparation");
  await fs.link(file, path.join(upload, name)).catch((e) => {
    if (e.code !== "EEXIST") throw e;
  });
  assets[kind] = {
    key: "map-models/" + name,
    sha256,
    size: bytes.length,
    mimeType: mime,
    fileName: kind === "source" ? path.basename(file) : kind + ext,
  };
}
const hash = createHash("sha256")
  .update(
    "majestic-individual-materials-v1:" + JSON.stringify({ model, assets }),
  )
  .digest();
hash[6] = (hash[6] & 15) | 128;
hash[8] = (hash[8] & 63) | 128;
const hex = hash.subarray(0, 16).toString("hex"),
  id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
const registry = JSON.parse(
  await fs.readFile(
    path.join(base, "registry-snapshot.json"),
    "utf8",
  ),
);
const registered = registry.find((m) => m.id === id);
const version =
  registered?.version ??
  1 +
    Math.max(
      0,
      ...registry
        .filter((m) => m.collection === row.collection && m.sourceCode === code)
        .map((m) => m.version),
    );
const prepared = { ...model, id, version, assets };
report.model = prepared;
await fs.writeFile(
  path.join(review, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
await fs.writeFile(
  path.join(upload, "catalogue.json"),
  JSON.stringify([prepared], null, 2) + "\n",
);
console.log("MAJESTIC_MANIFEST", code, version, tiers);
