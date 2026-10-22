import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export function previewFrame(model) {
  return Object.fromEntries(
    ["width", "height", "mountDepth", "placementOffset"].map((key) => [
      key,
      model[key],
    ]),
  );
}

export function validatePreviewReceipt(receipt, expected) {
  assert.equal(receipt.version, 1, "Regenerate the final transparent preview");
  for (const key of ["renderSHA256", "previewModelSHA256", "imageSHA256"]) {
    assert.equal(receipt[key], expected[key], "Final preview is stale: " + key);
  }
  assert.deepEqual(
    receipt.frame,
    expected.frame,
    "Final preview uses a different mounting frame",
  );
}

export async function reviewedMedievalPreview(directory, model) {
  const image = path.join(directory, "transparent-preview.png");
  const receipt = JSON.parse(
    await fs.readFile(path.join(directory, "transparent-preview.json"), "utf8"),
  );
  const digest = async (file) =>
    createHash("sha256")
      .update(await fs.readFile(path.join(directory, file)))
      .digest("hex");
  validatePreviewReceipt(receipt, {
    renderSHA256: await digest("render.glb"),
    previewModelSHA256: await digest("preview-model.glb"),
    imageSHA256: await digest("transparent-preview.png"),
    frame: previewFrame(model),
  });
  return image;
}
