import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { clipBody, measurePads, pegPrimitive } from "./peg-geometry.mjs";
const root = path.resolve(import.meta.dirname, "../.."),
  models = path.join(root, "models/collections");
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { dequantize, weld, prune, meshopt } = require("@gltf-transform/functions"),
  { MeshoptDecoder, MeshoptEncoder } = require("meshoptimizer");
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });
const registry = JSON.parse(
    await fs.readFile(path.join(models, "registry.json"), "utf8"),
  ),
  manifest = JSON.parse(
    await fs.readFile(path.join(models, "manifest.json"), "utf8"),
  );
const depths = new Map(
  manifest.map((m) => [
    `${m.collection}:${m.code}:${m.sourceName}`,
    m.mountDepth,
  ]),
);
const latest = new Map();
for (const m of registry) {
  const key = `${m.collection}:${m.sourceCode}:${m.sourceName}`;
  if (!latest.has(key)) latest.set(key, m);
}
const codes = process.argv
  .find((a) => a.startsWith("--codes="))
  ?.slice(8)
  .split(",");
const out = path.join(models, "simple-pegs");
await fs.mkdir(out, { recursive: true });
async function source(asset) {
  for (const folder of ["upload", "painted/upload"]) {
    const file = path.join(models, folder, path.basename(asset.key));
    if (await fs.stat(file).catch(() => null)) return file;
  }
  throw new Error("Missing local asset " + asset.fileName);
}
for (const model of latest.values()) {
  const key = `${model.collection}:${model.sourceCode}:${model.sourceName}`,
    depth = depths.get(key);
  if (!depth || (codes && !codes.includes(model.sourceCode))) continue;
  const slug = `${model.collection}__${model.sourceCode.replaceAll(" ", "_")}__${model.assets.render.sha256.slice(0, 12)}`;
  const directory = path.join(out, slug);
  await fs.mkdir(directory, { recursive: true });
  if (await fs.stat(path.join(directory, "report.json")).catch(() => null))
    continue;
  const report = { model: { ...model, mountDepth: depth }, tiers: {} };
  for (const tier of ["render", "lod"]) {
    const doc = await io.read(await source(model.assets[tier]));
    await doc.transform(dequantize());
    for (const extension of doc.getRoot().listExtensionsUsed())
      if (extension.extensionName === "EXT_meshopt_compression")
        extension.dispose();
    const parts = [];
    for (const node of doc.getRoot().listNodes())
      if (node.getMesh())
        for (const primitive of node.getMesh().listPrimitives())
          parts.push({ primitive, matrix: node.getWorldMatrix() });
    const pads = measurePads(parts, depth);
    const before = parts.reduce(
      (n, p) =>
        n +
        (p.primitive.getIndices()?.getCount() ||
          p.primitive.getAttribute("POSITION").getCount()) /
          3,
      0,
    );
    let body = 0;
    for (const p of parts) body += clipBody(doc, p.primitive, p.matrix, depth);
    const peg = pegPrimitive(doc, pads, depth, model.collection),
      mesh = doc.createMesh("Insertion geometry").addPrimitive(peg),
      node = doc.createNode("Insertion geometry").setMesh(mesh);
    doc.getRoot().listScenes()[0].addChild(node);
    await doc.transform(weld(), prune());
    if (tier === "render")
      await io.write(path.join(directory, "preview-model.glb"), doc);
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
    await io.write(path.join(directory, `${tier}.glb`), doc);
    report.tiers[tier] = {
      before,
      body,
      pegs: pads.length,
      pegTriangles: pads.length * 12,
      after: body + pads.length * 12,
    };
  }
  await fs.writeFile(
    path.join(directory, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "SIMPLIFIED_PEG",
    model.collection,
    model.sourceCode,
    report.tiers.render,
  );
}
