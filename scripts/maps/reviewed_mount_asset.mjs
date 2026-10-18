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
        m.primitives.some((p) =>
          /^(Insertion earth|Simple insertion pegs)/.test(
            glb.json.materials?.[p.material]?.name ?? "",
          ),
        ),
      ),
      "Zero-depth native model contains a generated peg",
    );
    return expectedHash;
  }
  await validateStandardMount(after, report.model);
  let originalModel, input, inputHash;
  if (report.mountStandard?.profile === STANDARD_MOUNT.name) {
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
  await verifyStandardMountBody(before, after, originalModel, report.model);
  return inputHash;
}
