// Publish one visually accepted manifest, then verify resources and grouping.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mapTool } from "./mcp_maps_client.mjs";
import { applyBehaviour } from "./apply-medieval-behaviour.mjs";
import { reviewedMountAssetHash } from "./reviewed_mount_asset.mjs";
import { validateReceiverReport } from "./receiver_frame_review.mjs";
const run = promisify(execFile);
const code = process.argv[2];
if (!/^MT1-\d{3}$/.test(code || ""))
  throw new Error("One source code required");
const root = path.resolve(import.meta.dirname, "../..");
const base = path.join(root, "models/collections/medieval-town-vol1");
const upload = path.join(base, "upload", code);
const manifest = JSON.parse(
  await fs.readFile(path.join(upload, "catalogue.json"), "utf8"),
);
assert.equal(manifest.length, 1);
const expected = manifest[0];
const reportPath = path.join(base, "review", code, "report.json");
const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
assert.deepEqual(
  report.model,
  expected,
  "Publication manifest differs from reviewed resources",
);
const nativeQAHashes = {};
if (expected.tileType === "frame")
  await validateReceiverReport(report, path.join(base, "review", code), await mapTool("map_tile_models_list"));
for (const tier of ["render", "lod"])
  nativeQAHashes[tier] = await reviewedMountAssetHash(
    report,
    tier,
    path.join(base, "review", code),
    expected.assets[tier].sha256,
  );
const flames =
  report.recipe.materials.surfaceParts?.filter((p) => p.kind === "flame") || [];
if (flames.length && !report.recipe.proceduralFire)
  for (const tier of ["render", "lod"]) {
    const evidence = report.materialChannelReview?.[tier];
    assert.equal(
      report.materialChannelAssets?.[tier],
      nativeQAHashes[tier],
      "Flame QA differs from publication resources",
    );
    assert.equal(
      createHash("sha256")
        .update(
          await fs.readFile(path.join(base, "review", code, tier + ".glb")),
        )
        .digest("hex"),
      expected.assets[tier].sha256,
    );
    assert.equal(
      evidence?.emissionOutsideFlame,
      0,
      "Unverified flame boundaries",
    );
    assert.equal(evidence?.metalDomainMismatches, 0);
    assert.equal(evidence?.roughnessDomainMismatches, 0);
    for (const part of flames)
      assert.ok(
        evidence?.flamePartSamples?.[part.name] >= 10,
        "Unverified flame: " + part.name,
      );
  }
const liquidCount =
  report.recipe.materials.surfaceParts?.filter((p) => p.kind === "liquid")
    .length || 0;
const glassCount =
  report.recipe.materials.surfaceParts?.filter((p) => p.kind === "glass")
    .length || 0;
if (glassCount)
  for (const tier of ["render", "lod"]) {
    assert.equal(
      report.glassPixelReview?.[tier]?.length,
      glassCount * 2,
      "Unverified glass surfaces",
    );
    assert.equal(
      report.glassPixelAssets?.[tier],
      nativeQAHashes[tier],
      "Glass QA differs from publication resources",
    );
    for (const pane of report.glassPixelReview[tier])
      assert.ok(
        pane.greenRatio >= 1.1 &&
          pane.deviationMM <= 0.15 &&
          pane.normalFacing >= 0.5,
        "Glass pane lost colour or shape",
      );
  }
if (liquidCount)
  for (const tier of ["render", "lod"]) {
    assert.equal(
      report.liquidPixelReview?.[tier]?.length,
      liquidCount,
      "Unverified liquid surfaces",
    );
    assert.equal(
      report.liquidPixelAssets?.[tier],
      nativeQAHashes[tier],
      "Liquid QA differs from publication resources",
    );
    for (const floor of report.liquidPixelReview[tier]) {
      assert.ok(
        floor.dominantRatio >= 1.1 &&
          floor.deviationMM <= 0.1 &&
          floor.normalZ >= 0.5,
        "Liquid floor lost colour or geometry",
      );
    }
  }
if (report.roughnessCorrection)
  for (const tier of ["render", "lod"]) {
    assert.equal(
      report.materialChannelReview?.[tier]?.metalDomainMismatches,
      0,
      "Unverified corrected metallic channel",
    );
    assert.equal(
      report.materialChannelReview?.[tier]?.roughnessDomainMismatches,
      0,
      "Unverified corrected roughness",
    );
  }
const uploader = process.env.DNDSHARE_MAP_UPLOADER;
const { stderr } = await run(
  uploader || "go",
  [
    ...(uploader ? [] : ["run", "./cmd/map-model-upload"]),
    "-assets",
    upload,
    "-workers",
    "1",
  ],
  { cwd: root, maxBuffer: 1048576 },
);
if (stderr) process.stdout.write(stderr);
const current = await mapTool("map_tile_model_get", { id: expected.id });
assert.equal(current.definitionId, expected.definitionId);
// Asset publication has no authority to reassign either catalogue code.
const behaviour = await applyBehaviour(expected.definitionId, report.recipe);
if (behaviour) {
  report.behaviourPublication = behaviour;
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(
    "MEDIEVAL_BEHAVIOUR_CONFIRMED",
    code,
    behaviour.revision,
    behaviour.defaultLights.length,
    behaviour.transitions.length,
  );
}
const registry = await mapTool("map_tile_models_list");
const published = registry.find((m) => m.id === expected.id);
const withoutGrouping = ({ code: _code, variantCode: _variant, ...model }) =>
  model;
assert.deepEqual(
  withoutGrouping(published),
  withoutGrouping(expected),
  "Published metadata or assets differ",
);
// Refresh only nonvisual grouping fields in the review artifacts; keep the
// geometry, source identity, assets and their visual approval unchanged.
Object.assign(expected, {
  code: published.code,
  variantCode: published.variantCode,
});
report.model = expected;
await fs.writeFile(
  path.join(upload, "catalogue.json"),
  JSON.stringify([expected], null, 2) + "\n",
);
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
await fs.writeFile(
  path.join(base, "registry-snapshot.json"),
  JSON.stringify(registry, null, 2) + "\n",
  { mode: 0o600 },
);
const confirmed = await run(
  "node",
  ["scripts/maps/record-medieval.mjs", code],
  { cwd: root },
);
process.stdout.write(confirmed.stdout);
