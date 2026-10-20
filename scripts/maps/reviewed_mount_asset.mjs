import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  STANDARD_MOUNT,
  validateStandardMount,
  verifyStandardMountBody,
} from "./standard_mount.mjs";
import { readGlb } from "./glb_textures.mjs";
import { createRequire } from "node:module";
import { initializeStructureReferences } from "./medieval_source_reference.mjs";
import { addModelWaterMask } from "./model_water_mask.mjs";
import {
  RECESS_MOUNT,
  RECESS_OUTER,
  validateRecessMount,
  validateRecessConstruction,
  validateRecessFrameFit,
} from "./recess_mount.mjs";
import {
  stripSculptedFlames,
  triangleFingerprint,
  materialImages,
} from "./model_flame_geometry.mjs";
// Native-space pixel QA stays bound to its original bytes. A separate exact body proof
// links those bytes to the final translated model without relabelling old QA hashes.
export async function reviewedMountAssetHash(report, tier, dir, expectedHash) {
  const after = await fs.readFile(path.join(dir, tier + ".glb")),
    hash = (b) => createHash("sha256").update(b).digest("hex");
  assert.equal(hash(after), expectedHash, "Final asset differs from manifest");
  if (report.model.mountDepth === 0) {
    const glb = readGlb(after);
    assert.ok(
      !glb.json.meshes.some((m) =>
        m.primitives.some(
          (p) =>
            /^(Insertion earth|Simple insertion pegs)/.test(
              glb.json.materials?.[p.material]?.name ?? "",
            ) || glb.json.materials?.[p.material]?.name === RECESS_OUTER,
        ),
      ),
      "Zero-depth native model contains a generated peg",
    );
    return expectedHash;
  }
  if (report.recipe?.recessMount) {
    validateRecessConstruction(report.recessConstruction, report.sourceSHA256);
    await validateRecessMount(after, report.model, report.recessConstruction);
    await validateRecessFrameFit(report, dir);
  } else await validateStandardMount(after, report.model);
  let mountedBody = after;
  if (report.waterAnimation) {
    mountedBody = await fs.readFile(
      path.resolve(
        dir,
        "../../water-animation",
        report.model.sourceCode,
        "before",
        tier + ".glb",
      ),
    );
    assert.equal(hash(mountedBody), report.waterAnimation.before[tier].sha256);
    assert.equal(expectedHash, report.waterAnimation.tiers[tier].sha256);
    const require = createRequire(
        "/private/tmp/dndshare-model-tools/package.json",
      ),
      { NodeIO } = require("@gltf-transform/core"),
      { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
      { MeshoptDecoder } = require("meshoptimizer");
    await MeshoptDecoder.ready;
    const io = new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({ "meshopt.decoder": MeshoptDecoder }),
      original = await io.readBinary(mountedBody),
      actual = await io.readBinary(after);
    await initializeStructureReferences(
      report.recipe.materials,
      path.resolve(dir, "../../inventory.json"),
    );
    addModelWaterMask(
      original,
      report.recipe.materials,
      report.recipe.mountDepthMM - report.model.mountDepth * 35,
    );
    assert.equal(
      triangleFingerprint(actual),
      triangleFingerprint(original),
      "Model changed beyond measured water mask",
    );
    assert.deepEqual(
      materialImages(actual),
      materialImages(original),
      "Water annotation changed painting",
    );
    assert.equal(
      report.model.assets.shadow.sha256,
      report.waterAnimation.before.shadow.sha256,
      "Static geometry requires unchanged shadows",
    );
  }
  if (report.proceduralFire) {
    const baseline = path.resolve(
      dir,
      "../../light-effects",
      report.model.sourceCode,
      "before",
      tier + ".glb",
    );
    mountedBody = await fs.readFile(baseline);
    assert.equal(
      hash(mountedBody),
      report.proceduralFire.before[tier].sha256,
      "Flame-removal baseline changed",
    );
    assert.equal(expectedHash, report.proceduralFire.tiers[tier].sha256);
    const require = createRequire(
        "/private/tmp/dndshare-model-tools/package.json",
      ),
      { NodeIO } = require("@gltf-transform/core"),
      { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
      { MeshoptDecoder } = require("meshoptimizer");
    await MeshoptDecoder.ready;
    const io = new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({ "meshopt.decoder": MeshoptDecoder }),
      original = await io.readBinary(mountedBody),
      actual = await io.readBinary(after),
      images = materialImages(original);
    await initializeStructureReferences(
      report.recipe.materials,
      path.resolve(dir, "../../inventory.json"),
    );
    stripSculptedFlames(
      original,
      report.recipe.materials,
      report.recipe.mountDepthMM - report.model.mountDepth * 35,
    );
    assert.equal(
      triangleFingerprint(actual),
      triangleFingerprint(original),
      "Body changed outside measured flame removal",
    );
    assert.deepEqual(
      materialImages(actual),
      images,
      "Body textures changed during flame removal",
    );
    assert.ok(
      actual
        .getRoot()
        .listMaterials()
        .every(
          (m) =>
            !m.getEmissiveTexture() &&
            m.getEmissiveFactor().every((v) => v === 0),
        ),
    );
  }
  let originalModel, input, inputHash;
  if (
    report.mountStandard?.profile === STANDARD_MOUNT.name ||
    (report.recipe?.recessMount &&
      report.mountStandard?.profile === RECESS_MOUNT)
  ) {
    originalModel = report.mountStandard.originalModel;
    input = path.join(dir, report.mountStandard.inputs[tier].file);
    inputHash = report.mountStandard.inputs[tier].sha256;
  } else if (report.mountStandardCorrection?.profile === STANDARD_MOUNT.name) {
    originalModel = report.mountStandardCorrection.originalModel;
    input = path.resolve(
      dir,
      "../../mount-standard",
      report.model.sourceCode,
      "input-" + tier + ".glb",
    );
    inputHash = originalModel.assets[tier].sha256;
  } else
    throw Error(
      "Standardized painting needs its original native QA byte evidence",
    );
  const before = await fs.readFile(input);
  assert.equal(hash(before), inputHash);
  await verifyStandardMountBody(
    before,
    mountedBody,
    originalModel,
    report.model,
  );
  return inputHash;
}
