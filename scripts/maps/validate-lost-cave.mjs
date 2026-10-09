import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { mountingSurface } from "./mounting_surface.mjs";
import { assertSameSurface } from "./surface_geometry.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
const file = process.argv[2];
if (!file) throw new Error("One Lost Cave report required");
const report = JSON.parse(await fs.readFile(file, "utf8")),
  dir = path.dirname(path.resolve(file));
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { getBounds } = require("@gltf-transform/functions"),
  { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const checks = {};
const reference = process.argv
  .find((a) => a.startsWith("--reference="))
  ?.slice(12);
for (const tier of ["render", "lod"]) {
  const before = await io.read(
      await localModelAsset(report.model.assets[tier]),
    ),
    after = await io.read(path.join(dir, tier + ".glb"));
  const a = getBounds(before.getRoot().listScenes()[0]),
    b = getBounds(after.getRoot().listScenes()[0]);
  const oldDrift = Math.max(
    ...["min", "max"].flatMap((s) => a[s].map((v, i) => Math.abs(v - b[s][i]))),
  );
  let drift = oldDrift;
  if (report.geometryCorrection) {
    const [low, high] = report.rebake[tier].sourceBoundsMM;
    const expected = {
      min: [low[0] / 35, low[2] / 35, -high[1] / 35],
      max: [high[0] / 35, high[2] / 35, -low[1] / 35],
    };
    drift = Math.max(
      ...["min", "max"].flatMap((s) =>
        expected[s].map((v, i) => Math.abs(v - b[s][i])),
      ),
    );
    if (
      report.model.assets.source.sha256 !==
        report.geometryCorrection.sourceSHA256 ||
      Math.abs(b.max[1] - report.model.maxHeight) > 0.03
    )
      throw new Error(
        "Corrected model differs from reviewed original sculpt or height",
      );
  }
  if (drift > 0.03) throw new Error("Accepted bounds drift exceeds1.05 mm");
  if (report.rebake[tier].sourceDeviationMM > 1)
    throw new Error("Geometry strays from original sculpt");
  checks[tier] = {
    boundsDrift: drift,
    ...(report.geometryCorrection
      ? {
          originalBoundsDrift: oldDrift,
          geometryCorrection: report.geometryCorrection.reason,
        }
      : {}),
    mounting:
      report.geometryCorrection?.mode === "remove-false-mount"
        ? (() => {
            if (
              report.model.mountDepth !==
                report.geometryCorrection.metadata.mountDepth ||
              report.model.mountDepth <= 0 ||
              report.rebake[tier].mountingMeshesRetained !== 0 ||
              mountingSurface(after)
                .getRoot()
                .listNodes()
                .some((n) => n.getMesh().listPrimitives().length)
            )
              throw new Error(
                "False hole mounting still covers the corrected source",
              );
            return { removedFalseMount: true };
          })()
        : assertSameSurface(mountingSurface(before), mountingSurface(after)),
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
await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
console.log("LOST_CAVE_SURFACES", checks);
