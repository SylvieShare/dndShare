// Fit the actual selected render/LOD/shadow against every native frame cell.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  nativeSeatSupport,
  nativeFrameCellCentre,
} from "./native_seat_support.mjs";
import { STANDARD_MOUNT } from "./standard_mount.mjs";
import { recessProfileID, validateRecessMount } from "./recess_mount.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { BufferGeometry, BufferAttribute, Box3, Vector3 } = require("three");
const { MeshBVH } = require("three-mesh-bvh");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { MeshoptDecoder } = require("meshoptimizer");
const root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections/medieval-town-vol1");
const code = process.argv[2];
assert.match(code || "", /^MT1-\d{3}$/);
const directory = path.join(base, "review", code),
  reportPath = path.join(directory, "report.json");
const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
assert.equal(
  report.model.mountDepth,
  STANDARD_MOUNT.depth,
  "Fit the final standardized resources",
);
assert.equal(report.model.mountProfile, recessProfileID(code));
const inv = JSON.parse(
  await fs.readFile(path.join(base, "inventory.json"), "utf8"),
);
const oldFit = JSON.parse(
  await fs.readFile(
    path.join(base, "mount-standard-native-frame-fit.json"),
    "utf8",
  ),
);
const datum = report.recipe.mountDepthMM;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const allLower = [],
  assets = {};
for (const tier of ["render", "lod", "shadow"]) {
  const bytes = await fs.readFile(path.join(directory, tier + ".glb"));
  assets[tier] = createHash("sha256").update(bytes).digest("hex");
  if (tier !== "shadow")
    await validateRecessMount(bytes, report.model, report.recessConstruction);
  const doc = await io.readBinary(bytes),
    bias = datum - report.model.mountDepth * 35;
  for (const node of doc.getRoot().listNodes())
    if (node.getMesh())
      for (const p of node.getMesh().listPrimitives()) {
        const pos = p.getAttribute("POSITION"),
          index = p.getIndices(),
          M = node.getWorldMatrix();
        assert.ok(index && p.getMode() === 4);
        for (let i = 0; i < index.getCount(); i += 3) {
          const tri = [0, 1, 2].map((j) => {
            const v = pos.getElement(index.getScalar(i + j), []),
              w = [0, 1, 2].map(
                (a) =>
                  M[a] * v[0] + M[a + 4] * v[1] + M[a + 8] * v[2] + M[a + 12],
              );
            return [w[0] * 35, -w[2] * 35, w[1] * 35 + bias];
          });
          const [a, b, c] = tri,
            area =
              (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
          if (area < -1e-9 && Math.min(a[2], b[2], c[2]) < datum + 0.001)
            allLower.push(...tri.flat());
        }
      }
}
const lower = Float32Array.from(allLower);
function baseline() {
  const vertices = [
    [STANDARD_MOUNT.bottomWidth * 17.5, datum - STANDARD_MOUNT.depth * 35],
    [17.5, datum],
  ].flatMap(([r, z]) => [
    [-r, -r, z],
    [r, -r, z],
    [r, r, z],
    [-r, r, z],
  ]);
  const faces = [
    [0, 2, 1],
    [0, 3, 2],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    faces.push([i, j, j + 4], [i, j + 4, i + 4]);
  }
  return Float32Array.from(faces.flatMap((f) => f.flatMap((i) => vertices[i])));
}
const results = [];
for (const row of inv.filter((r) => Number(r.code.slice(4)) >= 700)) {
  const raw = await fs.readFile(path.join(root, "models", row.sourcePath));
  assert.equal(
    createHash("sha256").update(raw).digest("hex"),
    row.sourceSHA256,
    "Native frame source changed",
  );
  const n = raw.readUInt32LE(80);
  assert.equal(raw.length, 84 + n * 50);
  const native = new Float32Array(n * 9),
    flat = new Float32Array(n * 9);
  for (let t = 0; t < n; t++)
    for (let k = 0; k < 9; k++)
      native[t * 9 + k] = raw.readFloatLE(84 + t * 50 + 12 + k * 4);
  for (let i = 0; i < native.length; i++) flat[i] = i % 3 === 2 ? 0 : native[i];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(flat, 3));
  const tree = new MeshBVH(geometry);
  const W = Math.round((row.max[0] - row.min[0]) / 35),
    H = Math.round((row.max[1] - row.min[1]) / 35),
    slots = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [cx, cy] = nativeFrameCellCentre(W, H, x, y);
      const ordinary = nativeSeatSupport(
        baseline(),
        native,
        geometry,
        tree,
        cx,
        cy,
        datum,
      );
      const reference = oldFit
        .find((r) => r.code === row.code)
        .slots.find(
          (s) =>
            Math.abs(s.centerMM[0] - cx) < 0.001 &&
            Math.abs(s.centerMM[1] - cy) < 0.001,
        );
      assert.ok(
        Math.abs(ordinary.verifiedSeatMM - reference.verifiedSeatMM) < 0.002,
        "Independent ordinary-frustum calculation differs",
      );
      const fit = nativeSeatSupport(
          lower,
          native,
          geometry,
          tree,
          cx,
          cy,
          datum,
        ),
        rise = fit.verifiedSeatMM - row.max[2];
      assert.ok(
        Number.isFinite(rise) && rise >= 0 && rise / 35 <= 0.15,
        "Measured native recess seating exceeds supported range",
      );
      slots.push({
        x,
        y,
        centerMM: [cx, cy],
        frameTopMM: row.max[2],
        insertionRiseMM: rise,
        ...fit,
      });
      console.log("RECESS_FRAME_FIT", code, row.code, x, y, rise);
    }
  results.push({ code: row.code, sourceSHA256: row.sourceSHA256, slots });
  geometry.dispose();
}
assert.equal(results.length, 15);
assert.equal(
  results.reduce((n, r) => n + r.slots.length, 0),
  90,
);
const profile = {
  schemaVersion: 1,
  profile: recessProfileID(code),
  sourceCode: code,
  sourceSHA256: report.sourceSHA256,
  reference: STANDARD_MOUNT,
  assets,
  lowerSurfaceSHA256: createHash("sha256")
    .update(Buffer.from(lower.buffer))
    .digest("hex"),
  lowerTriangles: lower.length / 9,
  method:
    "Maximum of frameZ-bodyZ+nativeDatum over all XY triangle intersections; actual render/LOD/shadow lower surfaces;0.02mm clearance; native frame SHA verified",
  frames: results,
};
const target = path.join(
  root,
  "scripts/maps/recess-frame-fits",
  code + ".json",
);
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, JSON.stringify(profile, null, 2) + "\n");
report.recessFrameFit = {
  profile: profile.profile,
  frames: 15,
  cells: 90,
  assets,
  lowerSurfaceSHA256: profile.lowerSurfaceSHA256,
};
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(
  "RECESS_ALL_FRAMES_VERIFIED",
  code,
  15,
  90,
  Math.max(...results.flatMap((r) => r.slots.map((s) => s.insertionRiseMM))),
);
