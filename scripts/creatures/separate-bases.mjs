// Separate reviewed miniature geometry without changing its materials or UVs.
// Usage: node scripts/creatures/separate-bases.mjs SOURCE_REPO OUTPUT_DIRECTORY
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const source = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
const require = createRequire(path.join(source, "models/.map-model-tools-runtime/package.json"));
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { prune, join, weld, simplify, getBounds } = require("@gltf-transform/functions");
const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = require("meshoptimizer");
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder,
});
const baseMaterial = /base rim|slate base|miniature rim|miniature top/i;
const root = path.join(source, "models/creatures");
const kobold = JSON.parse(await fs.readFile(path.join(root, "kobold-1635-v2/publish/catalogue.json")))[0];
const family = JSON.parse(await fs.readFile(path.join(root, "kobold-family/publish/catalogue.json")));
const recipes = JSON.parse(await fs.readFile(path.join(source, "scripts/creatures/kobold-family.json")));
const models = [
  { model: kobold, folder: path.join(root, "kobold-1635-v2"), files: {
    render: "kobold-1635.glb", lod: "kobold-1635-lod.glb", source: "kobold-1635-master.glb",
  } },
  ...recipes.map(r => ({ model: family.find(m => m.id === r.modelId),
    folder: path.join(root, "kobold-family", r.slug), files: r.assetFiles })),
];
await fs.mkdir(path.join(output, "publish"), { recursive: true });
const catalogue = [], report = [];

async function split(file, keepBase) {
  const doc = await io.read(file);
  let removed = 0, kept = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      if (baseMaterial.test(p.getMaterial()?.getName() || "") !== keepBase) {
        mesh.removePrimitive(p); removed++;
      } else kept++;
    }
  }
  if (!removed || !kept) throw new Error(`Cannot separate ${file}: ${removed}/${kept}`);
  await doc.transform(prune());
  return doc;
}
function bounds(doc) { return getBounds(doc.getRoot().listScenes()[0]); }
function shift(doc, y) {
  for (const scene of doc.getRoot().listScenes())
    for (const node of scene.listChildren()) {
      const t = node.getTranslation(); node.setTranslation([t[0], t[1] + y, t[2]]);
    }
}
async function asset(doc, name) {
  const data = await io.writeBinary(doc);
  const sha256 = crypto.createHash("sha256").update(data).digest("hex");
  await fs.writeFile(path.join(output, "publish", `${sha256}.glb`), data);
  return { key: `map-models/${sha256}.glb`, sha256, size: data.length,
    mimeType: "model/gltf-binary", fileName: name };
}
async function shadow(doc) {
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    p.setMaterial(null);
    for (const semantic of p.listSemantics()) if (semantic !== "POSITION") p.setAttribute(semantic, null);
  }
  await doc.transform(prune(), join(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: .2, error: .001 }), prune());
  return doc;
}
for (const entry of models) {
  const next = { ...entry.model, assets: {} };
  const render = await split(path.join(entry.folder, entry.files.render), false);
  const datum = bounds(render).min[1];
  if (datum < .04 || datum > .08) throw new Error(`Unexpected foot datum ${entry.model.name}: ${datum}`);
  shift(render, -datum);
  const b = bounds(render);
  next.maxHeight = Math.ceil(b.max[1] * 10000) / 10000;
  next.assets.render = await asset(render, `${next.sourceCode}-render.glb`);
  for (const role of ["lod", "source"]) {
    const doc = await split(path.join(entry.folder, entry.files[role]), false);
    shift(doc, -datum);
    next.assets[role] = await asset(doc, `${next.sourceCode}-${role}.glb`);
  }
  const proxy = await io.read(path.join(output, "publish", path.basename(next.assets.lod.key)));
  next.assets.shadow = await asset(await shadow(proxy), `${next.sourceCode}-shadow.glb`);
  await fs.writeFile(path.join(output, `${next.id}.glb`), await io.writeBinary(render));
  // A preview must be rendered from the separated geometry before publishing.
  catalogue.push(next);
  report.push({ id: next.id, name: next.name, datum, bounds: b, previousAssets: entry.model.assets });
  console.log("BODY", next.sourceCode, datum, next.maxHeight);
}

const designs = [
  { entry: models[0], code: "pebbles", name: "Каменная подставка с галькой", nameEn: "Pebbled stone base" },
  { entry: models.find(e => e.model.sourceCode === "CRE-1672"), code: "slate", name: "Плоская сланцевая подставка", nameEn: "Flat slate base" },
];
for (const design of designs) for (const size of [.5, 1, 2, 3, 4, 6, 8]) {
  const doc = await split(path.join(design.entry.folder, design.entry.files.render), true);
  const scene = doc.getRoot().listScenes()[0], parent = doc.createNode("Separate miniature base");
  for (const node of scene.listChildren()) { scene.removeChild(node); parent.addChild(node); }
  parent.setScale([size, 1, size]); scene.addChild(parent);
  const code = `BASE-${design.code}-${String(size).replace(".", "p")}`;
  const hex = crypto.createHash("sha256").update(`dndshare:${code}:v1`).digest("hex").slice(0, 32).split("");
  hex[12] = "5"; hex[16] = "a";
  const id = `${hex.slice(0,8).join("")}-${hex.slice(8,12).join("")}-${hex.slice(12,16).join("")}-${hex.slice(16,20).join("")}-${hex.slice(20).join("")}`;
  const b = bounds(doc);
  const render = await asset(doc, `${code}.glb`);
  await fs.writeFile(path.join(output, `${id}.glb`), await io.writeBinary(doc));
  const proxy = await io.read(path.join(output, "publish", path.basename(render.key)));
  const next = { id, code: "BAS-stone", variantCode: "", collection: "BASE", collectionName: "Подставки существ",
    sourceCode: code, sourceName: code.toLowerCase(), name: `${design.name} (${size})`, nameEn: `${design.nameEn} (${size})`,
    groupName: "Каменные подставки", groupNameEn: "Stone bases", category: "creature-base", tileType: "object",
    textureDetail: "detailed", hasDecor: true, canStand: false, hidden: true, placementPoints: [],
    wallMode: "none", wallMask: 0, width: Math.ceil(size), height: Math.ceil(size), placementOffset: [0,0], mountDepth: 0,
    surfaceHeight: .06, maxHeight: Math.max(.06, Math.ceil(b.max[1] * 10000) / 10000), baseSize: size, blockers: [], tags: ["creature-base"], supportSlots: [],
    assets: { render, lod: render, source: render, shadow: await asset(await shadow(proxy), `${code}-shadow.glb`) } };
  catalogue.push(next);
  report.push({ id, name: next.name, bounds: b });
  console.log("BASE", code);
}
await fs.writeFile(path.join(output, "publish/catalogue.json"), JSON.stringify(catalogue, null, 2) + "\n");
await fs.writeFile(path.join(output, "separation-report.json"), JSON.stringify(report, null, 2) + "\n");
