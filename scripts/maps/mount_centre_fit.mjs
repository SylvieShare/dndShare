import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { STANDARD_MOUNT, validateStandardMount } from "./standard_mount.mjs";

const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { MeshoptDecoder } = require("meshoptimizer");
const tiers = ["render", "lod", "shadow"];
const mean = (points) => [0, 1].map((a) => points.reduce((s, p) => s + p[a], 0) / points.length);

function bounds(points) {
  assert.ok(points.length, "Missing insertion corners");
  const min = [0, 1].map((a) => Math.min(...points.map((p) => p[a])));
  const max = [0, 1].map((a) => Math.max(...points.map((p) => p[a])));
  return { min, max, centre: min.map((v, a) => (v + max[a]) / 2) };
}

function validateInput(fit) {
  assert.match(fit.sourceSHA256, /^[a-f0-9]{64}$/);
  const native = fit.nativeCentresMM, fitted = fit.fittedCentresMM;
  assert.ok(native.length && native.length === fitted.length);
  for (const p of [...native, ...fitted]) assert.ok(p.length === 2 && p.every(Number.isFinite));
  const tolerance = fit.requiredDecodedCentreToleranceMM;
  assert.ok(tolerance > 0 && tolerance <= 0.02, "Centre tolerance exceeds UD-016 precision");
  const a = mean(native), b = mean(fitted);
  assert.ok(a.every((v, i) => Math.abs(v - b[i]) < 1e-6), "Array fit moved its common centre");
  for (let i = 0; i < native.length; i++)
    assert.ok(native[i].every((v, a) => Math.abs(v - fitted[i][a]) <= tolerance), "Array fit moved a native centre too far");
  return tolerance;
}

export async function inspectMountCentreFit(bytes, model, fit, { shadow = false, mountCenterMM = [0, 0] } = {}) {
  const tolerance = validateInput(fit);
  if (!shadow) assert.equal((await validateStandardMount(bytes, model)).pads, fit.fittedCentresMM.length);
  await MeshoptDecoder.ready;
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder }).readBinary(bytes);
  const groups = fit.fittedCentresMM.map(() => ({ points: [], triangles: 0 }));
  const nearest = (p) => fit.fittedCentresMM.map((c) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2)
    .reduce((best, d, i, values) => d < values[best] ? i : best, 0);
  for (const node of doc.getRoot().listNodes()) if (node.getMesh()) {
    const mesh = node.getMesh();
    if (!shadow && mesh.getExtras().dndShareInsertionProfile !== STANDARD_MOUNT.name) continue;
    const M = node.getWorldMatrix();
    const native = (v) => {
      const w = [0, 1, 2].map((a) => M[a] * v[0] + M[a + 4] * v[1] + M[a + 8] * v[2] + M[a + 12]);
      return [w[0] * 35 + mountCenterMM[0], -w[2] * 35 + mountCenterMM[1], w[1] * 35];
    };
    for (const primitive of mesh.listPrimitives()) {
      const positions = primitive.getAttribute("POSITION"), indices = primitive.getIndices();
      if (shadow) {
        for (let i = 0; i < positions.getCount(); i++) {
          const p = native(positions.getElement(i, []));
          if (Math.abs(p[2]) <= 0.02) groups[nearest(p)].points.push(p);
        }
      } else {
        const count = indices?.getCount() ?? positions.getCount();
        for (let i = 0; i < count; i += 3) {
          const triangle = [0, 1, 2].map((j) => native(positions.getElement(indices ? indices.getScalar(i + j) : i + j, [])));
          // Assign complete triangles so the common top edge belongs to both pads.
          const group = groups[nearest(mean(triangle))];
          group.points.push(...triangle); group.triangles++;
        }
      }
    }
  }
  let maximumCoordinateDriftMM = 0;
  const depth = model.mountDepth * 35;
  const pads = groups.map((g, i) => {
    if (!shadow) assert.equal(g.triangles, 12, "Wrong insertion triangle count");
    const bottom = g.points.filter((p) => Math.abs(p[2]) <= 0.02);
    assert.equal(new Set(bottom.map((p) => p.slice(0, 2).map((v) => v.toFixed(4)).join(","))).size, 4);
    const base = bounds(bottom), top = shadow ? null : bounds(g.points.filter((p) => Math.abs(p[2] - depth) <= 0.02));
    for (const [section, size] of [[base, 25.96], ...(top ? [[top, 35]] : [])]) {
      for (let a = 0; a < 2; a++) {
        assert.ok(Math.abs(section.max[a] - section.min[a] - size) < 0.02, "Insertion section differs from UD-016");
        assert.ok(Math.abs(section.centre[a] - fit.fittedCentresMM[i][a]) < 0.003, "Decoded insertion left the fitted centre");
        const drift = Math.abs(section.centre[a] - fit.nativeCentresMM[i][a]);
        assert.ok(drift <= tolerance, "Decoded insertion moved from its native centre beyond tolerance");
        maximumCoordinateDriftMM = Math.max(maximumCoordinateDriftMM, drift);
      }
    }
    return { bottom: base, ...(top ? { top } : {}) };
  });
  if (!shadow) for (let i = 0; i < pads.length; i++) for (let j = 0; j < i; j++) {
    const overlap = [0, 1].map((a) => Math.min(pads[i].top.max[a], pads[j].top.max[a]) - Math.max(pads[i].top.min[a], pads[j].top.min[a]));
    assert.ok(overlap.some((v) => v <= 0.002), "Standard insertion tops overlap");
  }
  const decodedMean = mean(pads.map((p) => p.bottom.centre)), sourceMean = mean(fit.nativeCentresMM);
  assert.ok(decodedMean.every((v, a) => Math.abs(v - sourceMean[a]) < 0.002), "Decoded array moved its common centre");
  return { sha256: createHash("sha256").update(bytes).digest("hex"), pads, maximumCoordinateDriftMM };
}

export async function reviewSelectedMountCentreFit(directory, report) {
  const input = report.recipe.mountCentreFitReview;
  assert.equal(input.sourceSHA256, report.sourceSHA256, "Mount centre measurements belong to another source");
  const evidence = {};
  for (const tier of tiers) evidence[tier] = await inspectMountCentreFit(
    await fs.readFile(path.join(directory, tier + ".glb")), report.model, input,
    { shadow: tier === "shadow", mountCenterMM: report.recipe.mountCenterMM },
  );
  return { sourceSHA256: report.sourceSHA256, input: structuredClone(input), tiers: evidence };
}

export function assertReviewedMountCentreFit(report, assets) {
  if (!report.recipe.mountCentreFitReview) return;
  const proof = report.mountCentreFitReview;
  assert.ok(proof, "Validate fitted mount centres before publication");
  assert.equal(proof.sourceSHA256, report.sourceSHA256);
  assert.deepEqual(proof.input, report.recipe.mountCentreFitReview);
  assert.equal(proof.input.sourceSHA256, report.sourceSHA256);
  const tolerance = validateInput(proof.input);
  for (const tier of tiers) {
    assert.equal(proof.tiers[tier].sha256, assets[tier].sha256, "Mount centre QA differs from published resources");
    assert.ok(proof.tiers[tier].maximumCoordinateDriftMM <= tolerance);
  }
}
