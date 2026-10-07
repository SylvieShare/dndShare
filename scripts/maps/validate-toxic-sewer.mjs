import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { assertSameSurface } from "./surface_geometry.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
const file = process.argv[2];
if (!file) throw new Error("One Toxic Sewer report required");
const report = JSON.parse(await fs.readFile(file, "utf8")),
  dir = path.dirname(path.resolve(file));
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { getBounds, dequantize } = require("@gltf-transform/functions"),
  { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const checks = {};
const reference = process.argv
  .find((a) => a.startsWith("--reference="))
  ?.slice(12);
function mounting(doc) {
  const nodes = doc
    .getRoot()
    .listNodes()
    .filter((n) => n.getMesh())
    .map((n) => ({
      getWorldMatrix: () => n.getWorldMatrix(),
      getMesh: () => ({
        listPrimitives: () =>
          n
            .getMesh()
            .listPrimitives()
            .filter((p) =>
              p.getMaterial()?.getName().startsWith("Simple insertion pegs"),
            ),
      }),
    }));
  return { getRoot: () => ({ listNodes: () => nodes }) };
}
for (const tier of ["render", "lod"]) {
  const before = await io.read(
      await localModelAsset(report.model.assets[tier]),
    ),
    after = await io.read(path.join(dir, tier + ".glb"));
  const a = getBounds(before.getRoot().listScenes()[0]),
    b = getBounds(after.getRoot().listScenes()[0]);
  const drift = Math.max(
    ...["min", "max"].flatMap((s) => a[s].map((v, i) => Math.abs(v - b[s][i]))),
  );
  if (drift > 0.03) throw new Error("Accepted bounds drift exceeds1.05 mm");
  if (report.rebake[tier].sourceDeviationMM > 1)
    throw new Error("Geometry strays from original sculpt");
  checks[tier] = {
    boundsDrift: drift,
    mounting: assertSameSurface(mounting(before), mounting(after)),
    sourceDeviationMM: report.rebake[tier].sourceDeviationMM,
  };
  if (reference)
    checks[tier].candidate = assertSameSurface(
      await io.read(path.join(reference, tier + ".glb")),
      after,
    );
  if (
    report.tiers[tier].blackSurfacePixels ||
    report.tiers[tier].invalidNormalPixels
  )
    throw new Error("Decoded surface quality failed");
}
report.geometryChecks = checks;
if (report.preparedShadow) {
  const doc = await io.read(
    path.join(dir, path.basename(report.preparedShadow.asset.key)),
  );
  await doc.transform(dequantize());
  for (const extension of doc.getRoot().listExtensionsUsed())
    if (extension.extensionName === "EXT_meshopt_compression")
      extension.dispose();
  await io.write(path.join(dir, "shadow-preview.glb"), doc);
}
await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
console.log("TOXIC_SEWER_SURFACES", checks);
