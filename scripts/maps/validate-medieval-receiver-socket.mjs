// Compare the actual socket in packed meshes against its immutable STL.
import { validateReceiverRayDrift } from "./receiver_frame_review.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const req = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { NodeIO } = req("@gltf-transform/core"),
  { ALL_EXTENSIONS } = req("@gltf-transform/extensions"),
  { MeshoptDecoder } = req("meshoptimizer"),
  { BufferGeometry, BufferAttribute, Ray, Vector3, DoubleSide } = req("three"),
  { MeshBVH } = req("three-mesh-bvh");
await MeshoptDecoder.ready;
const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder }),
  root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections/medieval-town-vol1"),
  code = process.argv[2],
  final = process.argv.includes("--final"),
  candidate = process.argv.includes("--candidate=compact") ? "compact" : null;
assert.match(code ?? "", /^MT1-\d{3}$/);
const dir = path.join(
    base,
    "review",
    code,
    ...(candidate ? ["candidates", candidate] : []),
  ),
  file = dir + "/report.json",
  r = JSON.parse(await fs.readFile(file, "utf8")),
  record = JSON.parse(
    await fs.readFile(
      path.join(import.meta.dirname, "receiver-frame-fits", code + ".json"),
      "utf8",
    ),
  );
assert.equal(r.model.tileType, "frame");
assert.equal(record.sourceCode, code);
assert.equal(record.nativeDatumMM, r.recipe.mountDepthMM);
if (final) assert.equal(r.model.mountDepth, record.final.mountDepth);
const refs = record.socketProbes;
assert.ok(refs?.length >= 100, "Generate source socket probes first");
const raw = await fs.readFile(path.join(root, "models", r.sourcePath)),
  sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(sha(raw), r.sourceSHA256);
assert.equal(sha(raw), record.sourceSHA256);
const n = raw.readUInt32LE(80),
  positions = new Float32Array(n * 9);
for (let i = 0; i < n; i++)
  for (let k = 0; k < 9; k++)
    positions[i * 9 + k] = raw.readFloatLE(84 + i * 50 + 12 + k * 4);
const sourceGeometry = new BufferGeometry();
sourceGeometry.setAttribute("position", new BufferAttribute(positions, 3));
const sourceTree = new MeshBVH(sourceGeometry),
  evidence = {};
for (const tier of ["render", "lod", "shadow"]) {
  const bytes = await fs.readFile(dir + "/" + tier + ".glb"),
    doc = await io.readBinary(bytes),
    arr = [],
    bias = r.recipe.mountDepthMM - r.model.mountDepth * 35;
  for (const node of doc.getRoot().listNodes())
    if (node.getMesh())
      for (const p of node.getMesh().listPrimitives()) {
        const m = node.getWorldMatrix(),
          pos = p.getAttribute("POSITION"),
          idx = p.getIndices();
        for (let i = 0; i < idx.getCount(); i++) {
          const v = pos.getElement(idx.getScalar(i), []),
            w = [0, 1, 2].map(
              (a) =>
                m[a] * v[0] + m[a + 4] * v[1] + m[a + 8] * v[2] + m[a + 12],
            );
          arr.push(w[0] * 35, -w[2] * 35, w[1] * 35 + bias);
        }
      }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(Float32Array.from(arr), 3));
  const tree = new MeshBVH(g);
  let maximumNativeDriftMM = 0,
    maximumRayHitDriftMM = 0,
    maximumBoundaryDriftMM = 0,
    clear = 0,
    boundaryRayChanges = 0;
  for (const ref of refs) {
    const ray = new Ray(
        new Vector3(...ref.origin),
        new Vector3(...ref.direction),
      ),
      before = sourceTree.raycastFirst(ray, DoubleSide),
      after = tree.raycastFirst(ray, DoubleSide);
    assert.equal(!!before, !!ref.point);
    if (before)
      assert.ok(before.point.distanceTo(new Vector3(...ref.point)) < 0.001);
    const forward = before
        ? tree.closestPointToPoint(before.point).distance
        : null,
      reverse = after
        ? sourceTree.closestPointToPoint(after.point).distance
        : null;
    const comparison = validateReceiverRayDrift(
      !!before,
      !!after,
      forward,
      reverse,
    );
    maximumNativeDriftMM = Math.max(maximumNativeDriftMM, comparison.driftMM);
    if (comparison.boundary) {
      boundaryRayChanges++;
      maximumBoundaryDriftMM = Math.max(
        maximumBoundaryDriftMM,
        comparison.driftMM,
      );
    }
    if (before && after)
      maximumRayHitDriftMM = Math.max(
        maximumRayHitDriftMM,
        after.point.distanceTo(before.point),
      );
    if (!before && !after) clear++;
  }
  evidence[tier] = {
    sha256: sha(bytes),
    samples: refs.length,
    missingSurfaces: 0,
    clearAboveSocket: clear,
    boundaryRayChanges,
    maximumBoundaryDriftMM,
    maximumNativeDriftMM,
    maximumRayHitDriftMM,
  };
}
const review = {
  mode: final ? "final" : "native",
  sourceSHA256: r.sourceSHA256,
  nativeDatumMM: r.recipe.mountDepthMM,
  modelMountDepth: r.model.mountDepth,
  probeVersion: record.socketProbeVersion,
  probeSHA256: sha(Buffer.from(JSON.stringify(refs))),
  method:
    "Original horizontal and top-down first hits; bidirectional nearest-surface drift including bounded edge-ray changes; packed coordinates reconstructed to native mm",
  tiers: evidence,
};
r[final ? "receiverSocketReview" : "receiverSocketNativeReview"] = review;
await fs.writeFile(file, JSON.stringify(r, null, 2) + "\n");
console.log("MEDIEVAL_RECEIVER_SOCKET", code, review);
