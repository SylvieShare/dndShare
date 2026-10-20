// Run after native-coordinate painting QA/candidate selection and before final preview/manifest.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  STANDARD_MOUNT,
  fitStandardMount,
  verifyStandardMountBody,
  standardMountAssetInfo,
} from "./standard_mount.mjs";
import { writeBlenderPreview } from "./review_glb_preview.mjs";
import { prepareShadow } from "./shadow_model.mjs";
import {
  RECESS_MOUNT,
  fitRecessMount,
  validateRecessConstruction,
} from "./recess_mount.mjs";
const code = process.argv[2];
assert.match(code ?? "", /^MT1-\d{3}$/);
const base = path.resolve(
    import.meta.dirname,
    "../../models/collections/medieval-town-vol1",
  ),
  dir = path.join(base, "review", code),
  file = path.join(dir, "report.json"),
  r = JSON.parse(await fs.readFile(file, "utf8"));
assert.ok(
  r.optimization?.selection && !r.optimization.selection.startsWith("pending"),
  "Select the visually reviewed candidate first",
);
const recess = Boolean(r.recipe.recessMount);
const profile = recess ? RECESS_MOUNT : STANDARD_MOUNT.name;
if (recess) validateRecessConstruction(r.recessConstruction, r.sourceSHA256);
if (r.mountStandard?.profile === profile) {
  console.log("MEDIEVAL_STANDARD_ALREADY_SELECTED", code);
  process.exit(0);
}
const originalModel = structuredClone(r.model),
  stage = {
    profile,
    originalModel,
    inputs: {},
    proofs: {},
  };
for (const tier of ["render", "lod"]) {
  const before = await fs.readFile(path.join(dir, tier + ".glb")),
    result = recess
      ? await fitRecessMount(before, originalModel, r.recessConstruction)
      : await fitStandardMount(before, originalModel);
  if (result.unchanged) {
    assert.equal(
      originalModel.mountDepth,
      0,
      "Previously standardized input requires its source evidence",
    );
    continue;
  }
  const input = "mount-input-" + tier + ".glb";
  await fs.writeFile(path.join(dir, input), before);
  stage.inputs[tier] = {
    file: input,
    sha256: createHash("sha256").update(before).digest("hex"),
  };
  stage.proofs[tier] = await verifyStandardMountBody(
    before,
    result.bytes,
    originalModel,
    result.model,
  );
  await fs.writeFile(path.join(dir, tier + ".glb"), result.bytes);
  await writeBlenderPreview(
    result.bytes,
    path.join(
      dir,
      tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
    ),
  );
  r.model = result.model;
  r.tiers[tier] = {
    ...r.tiers[tier],
    bytes: result.bytes.length,
    ...(await standardMountAssetInfo(result.bytes)),
  };
}
if (originalModel.mountDepth === 0) {
  console.log("MEDIEVAL_NATIVE_MODEL_UNCHANGED", code);
  process.exit(0);
}
const shadow = await prepareShadow(
  path.join(dir, "lod.glb"),
  path.join(dir, "shadow.glb"),
);
r.tiers.shadow = {
  bytes: shadow.asset.size,
  triangles: shadow.triangles,
  bounds: shadow.bounds,
};
r.mountStandard = stage;
r.publication = null;
await fs.writeFile(file, JSON.stringify(r, null, 2) + "\n");
console.log("MEDIEVAL_SELECTED_STANDARDIZED", code, r.model.mountDepth);
