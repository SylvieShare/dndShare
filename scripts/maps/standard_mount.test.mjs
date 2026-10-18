import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  STANDARD_MOUNT,
  standardMountMetadata,
  standardMountPads,
  fitStandardMount,
  validateStandardMount,
  verifyStandardMountBody,
} from "./standard_mount.mjs";
import { pegPrimitive } from "./peg-geometry.mjs";
const req = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { Document, NodeIO } = req("@gltf-transform/core");
const io = new NodeIO();
function metadata(depth) {
  return {
    id: "stable",
    definitionId: "MT1-test",
    collection: "medieval-town-vol1",
    sourceCode: "MT1-test",
    mountDepth: depth,
    surfaceHeight: depth + 0.25,
    maxHeight: depth + 1,
    width: 2,
    height: 2,
    placementOffset: [0.1, -0.2],
    placementPoints: [{ x: 0.25, y: 0.75, elevation: depth + 0.25 }],
    supportSlots: [
      {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        elevation: depth + 0.5,
        insertionRise: 0.03,
      },
    ],
    assets: { source: { sha256: "original" } },
    defaultLights: [{ position: [0.5, 0.5, 0.8] }],
  };
}
async function fixture(depth, count = 1, matrix = false) {
  const d = new Document(),
    b = d.createBuffer(),
    scene = d.createScene();
  const root = d.createNode("parent");
  if (matrix)
    root.setMatrix([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0.1, 0, -0.2, 1]);
  else root.setTranslation([0.1, 0, -0.2]);
  scene.addChild(root);
  const mat = d.createMaterial("painted body"),
    tex = d
      .createTexture()
      .setMimeType("image/png")
      .setImage(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
          "base64",
        ),
      );
  mat.setBaseColorTexture(tex);
  const p = d
    .createPrimitive()
    .setMaterial(mat)
    .setAttribute(
      "POSITION",
      d
        .createAccessor()
        .setType("VEC3")
        .setArray(
          new Float32Array([
            -1,
            depth + 0.2,
            -1,
            1,
            depth + 0.2,
            -1,
            0,
            depth + 0.7,
            1,
          ]),
        )
        .setBuffer(b),
    )
    .setAttribute(
      "NORMAL",
      d
        .createAccessor()
        .setType("VEC3")
        .setArray(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]))
        .setBuffer(b),
    )
    .setAttribute(
      "TEXCOORD_0",
      d
        .createAccessor()
        .setType("VEC2")
        .setArray(new Float32Array([0, 0, 1, 0, 0.5, 1]))
        .setBuffer(b),
    )
    .setIndices(
      d
        .createAccessor()
        .setType("SCALAR")
        .setArray(new Uint16Array([0, 1, 2]))
        .setBuffer(b),
    );
  root.addChild(
    d.createNode("body").setMesh(d.createMesh("body").addPrimitive(p)),
  );
  const collar = p.clone().setMaterial(d.createMaterial("Mount collar earth"));
  root.addChild(
    d.createNode("collar").setMesh(d.createMesh("collar").addPrimitive(collar)),
  );
  const centers =
    count === 1
      ? [[0, 0]]
      : count === 3
        ? [
            [-0.5, -0.5],
            [0.5, -0.5],
            [-0.5, 0.5],
          ]
        : [
            [-0.5, -0.5],
            [0.5, -0.5],
            [-0.5, 0.5],
            [0.5, 0.5],
          ];
  const pads = centers.map(([x, z]) => ({
    top: { min: [x - 0.49, z - 0.49], max: [x + 0.49, z + 0.49] },
    bottom: { min: [x - 0.325, z - 0.325], max: [x + 0.325, z + 0.325] },
  }));
  const peg = pegPrimitive(d, pads, depth, "ultimate-dungeon");
  peg.getMaterial().setName("Insertion earth");
  peg.setIndices(
    d
      .createAccessor()
      .setType("SCALAR")
      .setArray(Uint16Array.from({ length: count * 36 }, (_, i) => i))
      .setBuffer(b),
  );
  for (const a of peg.listAttributes()) a.setBuffer(b);
  root.addChild(
    d
      .createNode("old pegs")
      .setMesh(d.createMesh("old pegs").addPrimitive(peg)),
  );
  return io.writeBinary(d);
}
test("metadata preserves world elevations, identities and light heights", () => {
  const old = metadata(0.485714),
    next = standardMountMetadata(old);
  assert.equal(next.mountDepth, 0.153517);
  for (const k of ["surfaceHeight", "maxHeight"])
    assert.ok(
      Math.abs(next[k] - next.mountDepth - old[k] + old.mountDepth) < 1e-6,
    );
  assert.equal(next.placementPoints[0].elevation - next.mountDepth, 0.25);
  assert.equal(next.supportSlots[0].insertionRise, 0.03);
  for (const k of [
    "id",
    "definitionId",
    "assets",
    "placementOffset",
    "defaultLights",
  ])
    assert.deepEqual(next[k], old[k]);
  assert.equal(old.mountDepth, 0.485714);
});
test("pad centers and all three or four separate inserts survive", () => {
  for (const count of [1, 3, 4]) {
    const pads = standardMountPads(
      Array.from({ length: count }, (_, i) => ({
        top: { min: [i - 0.49, -0.49], max: [i + 0.49, 0.49] },
      })),
    );
    assert.equal(pads.length, count);
    pads.forEach((p, i) => {
      assert.equal((p.top.min[0] + p.top.max[0]) / 2, i);
      assert.ok(
        Math.abs(p.bottom.max[0] - p.bottom.min[0] - 25.96 / 35) < 1e-12,
      );
    });
  }
  assert.throws(() =>
    standardMountPads([{ top: { min: [0, 0], max: [2, 1] } }]),
  );
});
for (const [depth, count, matrix] of [
  [0.285714, 1, false],
  [0.485714, 1, true],
  [0.485714, 3, false],
  [0.485714, 4, true],
])
  test(`whole body remains fixed for depth ${depth}, ${count} pads, matrix ${matrix}`, async () => {
    const before = await fixture(depth, count, matrix),
      m = metadata(depth),
      result = await fitStandardMount(before, m);
    assert.equal(result.pads.length, count);
    assert.equal(
      (await validateStandardMount(result.bytes, result.model)).pads,
      count,
    );
    const proof = await verifyStandardMountBody(
      before,
      result.bytes,
      m,
      result.model,
    );
    assert.equal(proof.bodyBuffersAndTexturesUnchanged, true);
    assert.ok(proof.maximumWorldDriftMM < 0.00001);
    const again = await fitStandardMount(result.bytes, result.model);
    assert.equal(again.unchanged, true);
    assert.deepEqual(again.bytes, result.bytes);
  });
test("tag cannot hide bad geometry or inward faces", async () => {
  const result = await fitStandardMount(
    await fixture(0.485714),
    metadata(0.485714),
  );
  let d = await io.readBinary(result.bytes),
    p = d
      .getRoot()
      .listMeshes()
      .find((m) => m.getExtras().dndShareInsertionProfile)
      .listPrimitives()[0];
  p.getAttribute("POSITION").getArray()[0] += 0.1;
  await assert.rejects(
    validateStandardMount(await io.writeBinary(d), result.model),
  );
  d = await io.readBinary(result.bytes);
  p = d
    .getRoot()
    .listMeshes()
    .find((m) => m.getExtras().dndShareInsertionProfile)
    .listPrimitives()[0];
  const a = p.getIndices().getArray();
  [a[0], a[1]] = [a[1], a[0]];
  await assert.rejects(
    validateStandardMount(await io.writeBinary(d), result.model),
  );
});
test("invalid heights and unreviewed native mounts are rejected", async () => {
  assert.throws(() => standardMountMetadata(metadata(0)));
  assert.throws(() => standardMountMetadata(metadata(NaN)));
  const d = await io.readBinary(await fixture(0.485714));
  const peg = d
    .getRoot()
    .listMeshes()
    .find(
      (m) =>
        m.listPrimitives()[0].getMaterial().getName() === "Insertion earth",
    );
  for (const n of d.getRoot().listNodes())
    if (n.getMesh() === peg) n.setMesh(null);
  peg.dispose();
  const bytes = await io.writeBinary(d);
  await assert.rejects(fitStandardMount(bytes, metadata(0.4)));
  assert.equal((await fitStandardMount(bytes, metadata(0))).unchanged, true);
});

test("native painting QA is linked to standardized bytes without relabelling hashes", async () => {
  const fs = await import("node:fs/promises"),
    os = await import("node:os"),
    path = await import("node:path"),
    { createHash } = await import("node:crypto"),
    { reviewedMountAssetHash } = await import("./reviewed_mount_asset.mjs");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dndshare-mount-qa-"));
  try {
    const before = await fixture(0.485714),
      old = metadata(0.485714),
      result = await fitStandardMount(before, old),
      hash = (b) => createHash("sha256").update(b).digest("hex");
    await fs.writeFile(path.join(dir, "native.glb"), before);
    await fs.writeFile(path.join(dir, "render.glb"), result.bytes);
    const report = {
      model: result.model,
      mountStandard: {
        profile: STANDARD_MOUNT.name,
        originalModel: old,
        inputs: { render: { file: "native.glb", sha256: hash(before) } },
      },
    };
    assert.equal(
      await reviewedMountAssetHash(report, "render", dir, hash(result.bytes)),
      hash(before),
    );
    await fs.writeFile(
      path.join(dir, "native.glb"),
      Buffer.from("wrong painting"),
    );
    await assert.rejects(
      reviewedMountAssetHash(report, "render", dir, hash(result.bytes)),
    );
    await fs.writeFile(path.join(dir, "render.glb"), before);
    await assert.rejects(
      reviewedMountAssetHash({ model: old }, "render", dir, hash(before)),
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
