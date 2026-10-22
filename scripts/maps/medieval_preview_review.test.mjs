import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  previewFrame,
  reviewedMedievalPreview,
  validatePreviewReceipt,
} from "./medieval_preview_review.mjs";

const current = {
  renderSHA256: "current-render",
  previewModelSHA256: "current-preview-geometry",
  imageSHA256: "current-transparent-image",
  frame: { width: 1, height: 1, mountDepth: 0.153517, placementOffset: [0, 0] },
};
const receipt = () => ({ version: 1, ...structuredClone(current) });

test("publication selects the mounted preview and rejects later byte changes", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "medieval-preview-"),
  );
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  try {
    const files = {
      "render.glb": "mounted body",
      "preview-model.glb": "mounted Blender geometry",
      "preview.png": "native deep insertion thumbnail",
      "transparent-preview.png": "mounted thumbnail",
    };
    for (const [name, bytes] of Object.entries(files))
      await fs.writeFile(path.join(directory, name), bytes);
    await fs.writeFile(
      path.join(directory, "transparent-preview.json"),
      JSON.stringify({
        version: 1,
        renderSHA256: hash(files["render.glb"]),
        previewModelSHA256: hash(files["preview-model.glb"]),
        imageSHA256: hash(files["transparent-preview.png"]),
        frame: current.frame,
      }),
    );
    assert.equal(
      await reviewedMedievalPreview(directory, current.frame),
      path.join(directory, "transparent-preview.png"),
    );
    await fs.writeFile(path.join(directory, "render.glb"), "repainted body");
    await assert.rejects(
      reviewedMedievalPreview(directory, current.frame),
      /renderSHA256/,
    );
    await fs.writeFile(path.join(directory, "render.glb"), files["render.glb"]);
    await fs.writeFile(
      path.join(directory, "transparent-preview.png"),
      "unreviewed image",
    );
    await assert.rejects(
      reviewedMedievalPreview(directory, current.frame),
      /imageSHA256/,
    );
    await fs.rm(path.join(directory, "transparent-preview.json"));
    await assert.rejects(
      reviewedMedievalPreview(directory, current.frame),
      /ENOENT/,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("reviewed image remains valid when catalogue labels change", () => {
  validatePreviewReceipt(receipt(), current);
  assert.deepEqual(
    previewFrame({ ...current.frame, name: "Updated label" }),
    current.frame,
  );
});

test("native-depth thumbnail cannot accompany the standardized model", () => {
  const stale = receipt();
  stale.frame.mountDepth = 17 / 35;
  assert.throws(() => validatePreviewReceipt(stale, current), /mounting frame/);
  for (const [key, value] of [
    ["width", 2],
    ["height", 2],
    ["placementOffset", [0.5, 0]],
  ]) {
    const moved = receipt();
    moved.frame[key] = value;
    assert.throws(
      () => validatePreviewReceipt(moved, current),
      /mounting frame/,
    );
  }
});

test("geometry, procedural preview and image replacements invalidate review independently", () => {
  for (const key of ["renderSHA256", "previewModelSHA256", "imageSHA256"]) {
    const stale = receipt();
    stale[key] = "previous-bytes";
    assert.throws(
      () => validatePreviewReceipt(stale, current),
      new RegExp(key),
    );
  }
});

test("unreviewed legacy thumbnails cannot satisfy the publication gate", () => {
  assert.throws(
    () => validatePreviewReceipt({ ...current }, current),
    /Regenerate/,
  );
});
