import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { assertSameSurface } from "./surface_geometry.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
import { worldPoint } from "./peg-geometry.mjs";
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
function geometryBounds(doc) {
  const points = [];
  for (const node of doc.getRoot().listNodes())
    for (const p of node.getMesh()?.listPrimitives() ?? []) {
      const positions = p.getAttribute("POSITION");
      for (let i = 0; i < positions.getCount(); i++)
        points.push(
          worldPoint(positions.getElement(i, []), node.getWorldMatrix()),
        );
    }
  if (!points.length) throw Error("Mounting geometry missing");
  return {
    min: [0, 1, 2].map((i) => Math.min(...points.map((p) => p[i]))),
    max: [0, 1, 2].map((i) => Math.max(...points.map((p) => p[i]))),
  };
}
function assertOpenings(doc) {
  const probes = report.materialSpec.openingProbesMM ?? [];
  for (const [px, py] of probes) {
    const x = (px + report.sourceShiftMM[0]) / 35,
      z = -(py + report.sourceShiftMM[1]) / 35;
    for (const node of doc.getRoot().listNodes())
      for (const p of node.getMesh()?.listPrimitives() ?? []) {
        const positions = p.getAttribute("POSITION"),
          indices = p.getIndices();
        for (let i = 0; i < indices.getCount(); i += 3) {
          const [a, b, c] = [0, 1, 2].map((j) =>
            worldPoint(
              positions.getElement(indices.getScalar(i + j), []),
              node.getWorldMatrix(),
            ),
          );
          const den =
            (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
          if (Math.abs(den) < 1e-12) continue;
          const wa =
            ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den;
          const wb =
              ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den,
            wc = 1 - wa - wb;
          if (Math.min(wa, wb, wc) >= -1e-7)
            throw Error(
              "Decoded geometry blocks the original shaft at " + [px, py],
            );
        }
      }
  }
  return { clearVerticalRays: probes };
}
for (const tier of ["render", "lod"]) {
  const before = await io.read(
      await localModelAsset(report.model.assets[tier]),
    ),
    after = await io.read(path.join(dir, tier + ".glb"));
  await before.transform(dequantize());
  await after.transform(dequantize());
  const a = getBounds(before.getRoot().listScenes()[0]),
    b = getBounds(after.getRoot().listScenes()[0]);
  const drift = Math.max(
    ...["min", "max"].flatMap((s) => a[s].map((v, i) => Math.abs(v - b[s][i]))),
  );
  if (drift > 0.03) throw new Error("Accepted bounds drift exceeds1.05 mm");
  if (report.rebake[tier].sourceDeviationMM > 1)
    throw new Error("Geometry strays from original sculpt");
  let mountCheck;
  if (report.mountingCorrection) {
    if (
      report.materialSpec.mounting !== "source-opening" ||
      !report.materialSpec.openingProbesMM?.length
    )
      throw Error(
        "Explicit source-opening recipe and probes required for mount correction",
      );
    const a = geometryBounds(mounting(before)),
      b = geometryBounds(mounting(after));
    const source = report.rebake[tier].mountSourceBoundsMM;
    if (!source) throw Error("Measured original mounting bounds required");
    const expected = {
      min: [source[0][0] / 35, source[0][2] / 35, -source[1][1] / 35],
      max: [source[1][0] / 35, source[1][2] / 35, -source[0][1] / 35],
    };
    for (const axis of [0, 1, 2])
      for (const side of ["min", "max"])
        if (Math.abs(expected[side][axis] - b[side][axis]) > 0.015)
          throw Error(
            "Corrected mounting strays from measured original bounds",
          );
    if (
      b.min[0] + report.model.placementOffset[0] <
        -report.model.width / 2 - 0.03 ||
      b.max[0] + report.model.placementOffset[0] >
        report.model.width / 2 + 0.03 ||
      b.min[2] + report.model.placementOffset[1] <
        -report.model.height / 2 - 0.03 ||
      b.max[2] + report.model.placementOffset[1] >
        report.model.height / 2 + 0.03
    )
      throw Error("Corrected mounting no longer fits the occupied footprint");
    if (
      Math.abs(b.min[1]) > 0.0001 ||
      Math.abs(b.max[1] - report.model.mountDepth) > 0.0001
    )
      throw Error("Corrected mount changed depth or origin");
    mountCheck = {
      sourceOpening: true,
      before: a,
      after: b,
      measuredSource: expected,
      ...assertOpenings(after),
    };
  } else mountCheck = assertSameSurface(mounting(before), mounting(after));
  checks[tier] = {
    boundsDrift: drift,
    mounting: mountCheck,
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
  checks.shadow = assertOpenings(doc);
  for (const extension of doc.getRoot().listExtensionsUsed())
    if (extension.extensionName === "EXT_meshopt_compression")
      extension.dispose();
  await io.write(path.join(dir, "shadow-preview.glb"), doc);
}
await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
console.log("TOXIC_SEWER_SURFACES", checks);
