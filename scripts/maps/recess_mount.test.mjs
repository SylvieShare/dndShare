import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {reviewedMountAssetHash} from './reviewed_mount_asset.mjs';
import { STANDARD_MOUNT } from "./standard_mount.mjs";
import {
  validateRecessMount,
  fitRecessMount,
  recessProfileID,
  RECESS_OUTER,
  RECESS_HIDDEN,
  validateRecessConstruction,
  validateRecessFrameRecord,
} from "./recess_mount.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { Document, NodeIO } = require("@gltf-transform/core");
const io = new NodeIO();
const md = 17 / 35,
  bottom = md - STANDARD_MOUNT.depth,
  floor = 9 / 35;
const proof = {
  profile: "ud016-recess-v1",
  sourceSHA256: "a".repeat(64),
  reference: { ...STANDARD_MOUNT },
  nativeDatumMM: 17,
  topology: {
    boundaryEdges: 0,
    wireEdges: 0,
    multiEdges: 0,
    inconsistentEdges: 0,
    volume: 1,
  },
  cavityFaces: 10,
  upperFaces: 10,
  maximumCavityDeviationMM: 0,
  maximumUpperDeviationMM: 0,
  hiddenTriangles: 10,
  cavityProbesMM: [
    [0, 0, 9],
    [2, 2, 9],
    [-2, -2, 9],
  ],
};
const model = {
  sourceCode: "MT1-080",
  mountProfile: recessProfileID("MT1-080"),
  width: 1,
  height: 1,
  mountDepth: md,
  surfaceHeight: md + 0.2,
  maxHeight: md + 0.3,
  placementPoints: [{ x: 0.2, y: 0.5, elevation: md + 0.1 }],
  supportSlots: [],
};
function ring(r, y) {
  return [
    [-r, y, -r],
    [r, y, -r],
    [r, y, r],
    [-r, y, r],
  ];
}
async function fixture(solid = false, bad = false) {
  const doc = new Document(),
    scene = doc.createScene(),
    buffer = doc.createBuffer();
  const groups = new Map();
  function quad(name, points, wanted) {
    const sub = (a, b) => a.map((v, i) => v - b[i]);
    const a = sub(points[1], points[0]),
      b = sub(points[2], points[0]);
    const n = [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    if (n.reduce((s, v, i) => s + v * wanted[i], 0) < 0)
      points = points.toReversed();
    if (!groups.has(name)) groups.set(name, []);
    for (const i of [0, 1, 2, 0, 2, 3]) groups.get(name).push(...points[i]);
  }
  const top = ring(0.5, md),
    low = ring(STANDARD_MOUNT.bottomWidth / 2, bottom),
    holeTop = ring(0.2, md),
    holeLow = ring(0.22, bottom);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      normal = [
        [0, 0, -1],
        [1, 0, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ][i];
    quad(RECESS_OUTER, [low[i], low[j], top[j], top[i]], normal);
    quad(RECESS_OUTER, [top[i], top[j], holeTop[j], holeTop[i]], [0, 1, 0]);
    quad(RECESS_OUTER, [low[i], low[j], holeLow[j], holeLow[i]], [0, -1, 0]);
    quad(
      "Visible well",
      [ring(0.2, floor)[i], ring(0.2, floor)[j], holeTop[j], holeTop[i]],
      normal.map((v) => -v),
    );
    quad(
      RECESS_HIDDEN,
      [
        ring(0.22, floor - 0.02)[i],
        ring(0.22, floor - 0.02)[j],
        holeLow[j],
        holeLow[i],
      ],
      normal,
    );
  }
  quad("Visible well", ring(0.2, floor), [0, 1, 0]);
  quad(RECESS_HIDDEN, ring(0.22, floor - 0.02), [0, -1, 0]);
  if (solid) quad(RECESS_OUTER, holeTop, [0, 1, 0]);
  if (bad) groups.get(RECESS_OUTER)[0] -= 0.03;
  for (const [name, values] of groups) {
    const positions = doc
      .createAccessor()
      .setType("VEC3")
      .setArray(new Float32Array(values))
      .setBuffer(buffer);
    const indices = doc
      .createAccessor()
      .setType("SCALAR")
      .setArray(Uint16Array.from({ length: values.length / 3 }, (_, i) => i))
      .setBuffer(buffer);
    const primitive = doc
      .createPrimitive()
      .setAttribute("POSITION", positions)
      .setIndices(indices)
      .setMaterial(doc.createMaterial(name));
    scene.addChild(
      doc
        .createNode(name)
        .setMesh(doc.createMesh(name).addPrimitive(primitive)),
    );
  }
  return io.writeBinary(doc);
}
test("hollow envelope preserves the recessed floor while all roots move to UD-016", async () => {
  const before = await fixture();
  await validateRecessMount(before, model, proof);
  const result = await fitRecessMount(before, model, proof);
  assert.equal(result.model.mountDepth, STANDARD_MOUNT.depth);
  assert.equal(result.model.mountProfile, model.mountProfile);
  assert.equal(
    result.model.placementPoints[0].elevation - result.model.mountDepth,
    0.1,
  );
  await validateRecessMount(result.bytes, result.model, proof);
});
test("a filled opening and altered outer dimensions are rejected", async () => {
  await assert.rejects(
    validateRecessMount(await fixture(true), model, proof),
    /filled or changed/,
  );
  await assert.rejects(
    validateRecessMount(await fixture(false, true), model, proof),
  );
});
test("native construction identity and closed topology are mandatory", () => {
  assert.throws(() => validateRecessConstruction(proof, "b".repeat(64)));
  assert.throws(() =>
    validateRecessConstruction(
      { ...proof, topology: { ...proof.topology, multiEdges: 1 } },
      proof.sourceSHA256,
    ),
  );
  assert.throws(() =>
    validateRecessConstruction(
      { ...proof, cavityProbesMM: [] },
      proof.sourceSHA256,
    ),
  );
});
test('zero-depth native metadata cannot conceal a generated recessed insertion',async()=>{
 const bytes=await fixture(),directory=await fs.mkdtemp(path.join(os.tmpdir(),'recess-zero-'));
 try{
  await fs.writeFile(path.join(directory,'render.glb'),bytes);
  await assert.rejects(reviewedMountAssetHash({model:{...model,mountDepth:0,mountProfile:''},recipe:{}},'render',directory,createHash('sha256').update(bytes).digest('hex')),/generated peg/);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test("fifteen frames and ninety cells cannot be replaced by duplicated frame evidence", () => {
  const inventory = Array.from({ length: 15 }, (_, i) => ({
    code: "MT1-" + (700 + i),
    sourceSHA256: "f".repeat(64),
    min: [-105, -17.5, 0],
    max: [105, 17.5, 25],
  }));
  const assets = {
      render: "a".repeat(64),
      lod: "b".repeat(64),
      shadow: "c".repeat(64),
    },
    lower = "d".repeat(64);
  const fit = {
    schemaVersion: 1,
    sourceCode: model.sourceCode,
    profile: model.mountProfile,
    sourceSHA256: proof.sourceSHA256,
    reference: { ...STANDARD_MOUNT },
    assets,
    lowerSurfaceSHA256: lower,
    frames: inventory.map((r) => ({
      code: r.code,
      sourceSHA256: r.sourceSHA256,
      slots: Array.from({ length: 6 }, (_, x) => ({
        x,
        y: 0,
        centerMM: [(x - 2.5) * 35, 0],
        minimumSeatMM: 27.98,
        verifiedSeatMM: 28,
        insertionRiseMM: 3,
      })),
    })),
  };
  const report = {
    model,
    sourceSHA256: proof.sourceSHA256,
    recessFrameFit: { assets, lowerSurfaceSHA256: lower },
  };
  validateRecessFrameRecord(fit, report, inventory);
  const repeated = structuredClone(fit);
  repeated.frames[1] = structuredClone(repeated.frames[0]);
  assert.throws(
    () => validateRecessFrameRecord(repeated, report, inventory),
    /exactly once/,
  );
  assert.throws(() =>
    validateRecessFrameRecord(
      fit,
      {
        ...report,
        recessFrameFit: {
          assets: { ...assets, render: "e".repeat(64) },
          lowerSurfaceSHA256: lower,
        },
      },
      inventory,
    ),
  );
});
