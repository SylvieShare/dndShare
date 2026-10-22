import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { writeBlenderPreview } from "./review_glb_preview.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { Document, NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");

test("mounted preview retains the fire sample without adding it to the published body", async () => {
  const doc = new Document(),
    buffer = doc.createBuffer();
  const position = doc
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buffer);
  const primitive = doc.createPrimitive().setAttribute("POSITION", position);
  doc
    .createScene()
    .addChild(
      doc
        .createNode("Solid body")
        .setMesh(doc.createMesh().addPrimitive(primitive)),
    );
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
    bytes = await io.writeBinary(doc),
    before = Buffer.from(bytes);
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mounted-fire-preview-"),
  );
  try {
    const model = { width: 1, height: 1, mountDepth: 0.153517 };
    const lights = [
      {
        key: "fireplace",
        enabled: true,
        color: "#ffb45a",
        position: [0.6, 0.5, 0.5],
        effect: {
          kind: "fire",
          size: [0.3, 0.4],
          strength: 0.7,
          offset: [0, 0, 0],
        },
      },
    ];
    const target = path.join(directory, "on.glb");
    await writeBlenderPreview(bytes, target, { model, lights });
    const on = await io.read(target),
      flame = on
        .getRoot()
        .listNodes()
        .find((n) => n.getName() === "Preview flame fireplace");
    assert.ok(flame);
    assert.ok(
      Math.abs(flame.getTranslation()[1] - model.mountDepth - 0.5) < 1e-12,
    );
    assert.equal(
      on
        .getRoot()
        .listNodes()
        .filter((n) => n.getName() === "Solid body").length,
      1,
    );
    assert.deepEqual(Buffer.from(bytes), before);
    assert.equal((await io.readBinary(bytes)).getRoot().listNodes().length, 1);
    const offTarget = path.join(directory, "off.glb");
    await writeBlenderPreview(bytes, offTarget);
    assert.equal((await io.read(offTarget)).getRoot().listNodes().length, 1);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
