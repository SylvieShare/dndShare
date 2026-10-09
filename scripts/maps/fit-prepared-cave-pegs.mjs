// Fit mounting geometry after candidate selection, before shadow and publication.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { fitCavePegs } from "./fitted_cave_pegs.mjs";
import { readGlb } from "./glb_textures.mjs";
import { writeBlenderPreview } from "./review_glb_preview.mjs";
const file = process.argv[2];
if (!file) throw new Error("One selected Lost Cave report required");
const report = JSON.parse(await fs.readFile(file, "utf8"));
if (
  report.model.collection !== "lost-cave" ||
  report.recipe !== "lost-cave-individual-v1" ||
  !report.rebake
)
  throw new Error("Select an individually rebuilt Lost Cave model first");
if (report.preparedShadow)
  throw new Error("Fit mounting before preparing shadow");
const directory = path.dirname(path.resolve(file));
const registry = JSON.parse(
  await fs.readFile(
    path.resolve(
      import.meta.dirname,
      "../../models/collections/lost-cave/registry-snapshot.json",
    ),
    "utf8",
  ),
);
const current = registry.find(
  (m) => m.definitionId === report.model.definitionId,
);
assert.equal(current?.id, report.model.id, "Current model identity changed");
assert.deepEqual(current.assets.source, report.model.assets.source);
const results = [];
for (const tier of ["render", "lod"]) {
  const before = await fs.readFile(path.join(directory, tier + ".glb"));
  const result = await fitCavePegs(
    before,
    report.model,
    report.materialSpec.sourceInsertionFootprint,
  );
  if (!result.unchanged) {
    const a = readGlb(before),
      b = readGlb(result.bytes);
    assert.deepEqual(
      b.bin.subarray(0, a.json.buffers[0].byteLength),
      a.bin.subarray(0, a.json.buffers[0].byteLength),
    );
    for (const field of ["materials", "images", "textures"])
      assert.deepEqual(b.json[field], a.json[field]);
    assert.deepEqual(
      b.json.accessors.slice(0, a.json.accessors.length),
      a.json.accessors,
    );
    assert.deepEqual(
      b.json.bufferViews.slice(0, a.json.bufferViews.length),
      a.json.bufferViews,
    );
  }
  results.push({ tier, before, result });
}
if (results.every((r) => r.result.unchanged)) {
  console.log("PREPARED_CAVE_PEGS_UNCHANGED", report.model.sourceCode);
} else {
  if (results.some((r) => r.result.unchanged))
    throw new Error("Mounting differs between tiers");
  report.insertionProfile = {
    name: "lost-cave-slot-fit-v1",
    topWidthMM: 34.3,
    bottomWidthMM: 22.75,
    bodyAndAtlases: "selected candidate byte buffers retained",
    ...(report.materialSpec.sourceInsertionFootprint
      ? { sourceFootprint: report.materialSpec.sourceInsertionFootprint }
      : {}),
  };
  for (const { tier, before, result } of results) {
    await fs.writeFile(path.join(directory, tier + ".glb"), result.bytes);
    await writeBlenderPreview(
      result.bytes,
      path.join(
        directory,
        tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
      ),
    );
    report.tiers[tier] = {
      ...report.tiers[tier],
      beforeInsertionFitBytes: before.length,
      bytes: result.bytes.length,
      pads: result.pads.length,
      padBounds: result.pads,
      bodyAndTexturesUnchanged: true,
    };
  }
  await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
  console.log(
    "PREPARED_CAVE_PEGS_FITTED",
    report.model.sourceCode,
    results.map((r) => ({
      tier: r.tier,
      pads: r.result.pads.length,
      bytes: r.result.bytes.length,
    })),
  );
}
