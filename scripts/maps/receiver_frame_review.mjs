// A receiving model needs evidence for its source and every published mesh.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import standard from "./standard-mount-profile.json" with { type: "json" };
import { receiverCells, receiverSlotForCell, socketProbeCellSamples } from "./receiver_cells.mjs";
const tiers = ["render", "lod", "shadow"],
  rotations = [0, 90, 180, 270];
// Refresh a published receiver after measuring an additional recessed body.
// Geometry stays fixed; earlier declared rises can only remain or increase.
export function refreshReceiverSupportSlots(model, record, fits) {
  assert.equal(model.tileType, "frame");
  const expected = receiverCells(model);
  assert.deepEqual(record.cells.map(({ seatsMM, ...c }) => c), expected.map(({ seatsMM, ...c }) => c));
  const bias = record.nativeDatumMM - model.mountDepth * 35;
  assert.ok(Number.isFinite(bias) && Number.isFinite(record.quantizationReserveMM) && record.quantizationReserveMM >= 0);
  for (const slot of model.supportSlots) {
    const cells = record.cells.filter(c => receiverSlotForCell(model, c.x, c.y) === slot);
    for (const p of record.profiles) {
      const rows = fits.filter(f => f.profile === p.profile && cells.some(c => c.x === f.x && c.y === f.y));
      assert.equal(rows.length, cells.length * rotations.length * (tiers.length + 1));
      const cases = new Set(rows.map(r => [r.x, r.y, r.receiverTier, r.rotation].join(":")));
      for (const c of cells)
        for (const tier of ["source", ...tiers])
          for (const rotation of rotations)
            assert.ok(cases.has([c.x, c.y, tier, rotation].join(":")), "Missing receiving cell/tier/rotation");
      assert.ok(rows.every(r => Number.isFinite(r.verifiedSeatMM)));
      const seat = Math.max(...rows.map(r => r.verifiedSeatMM)) + record.quantizationReserveMM;
      const previous = p.profile === standard.name ? (slot.insertionRise ?? 0) : (slot.insertionRises?.[p.profile] ?? 0);
      const needed = (seat - bias) / 35 - slot.elevation;
      const rise = needed <= previous + 1e-12 ? previous : Math.ceil(needed * 1e6) / 1e6;
      assert.ok(Number.isFinite(rise) && rise >= 0 && rise <= 0.15);
      if (p.profile === standard.name) slot.insertionRise = rise;
      else (slot.insertionRises ??= {})[p.profile] = rise;
      for (const c of cells) c.seatsMM[p.profile] = slot.elevation * 35 + bias + rise * 35;
    }
  }
}
// A ray can cross a different side of a quantized boundary while the physical
// surface remains within the same 20 micrometre native-profile tolerance.
export function validateReceiverRayDrift(
  before,
  after,
  sourceToCandidateMM,
  candidateToSourceMM,
) {
  const distances = [];
  if (before) distances.push(sourceToCandidateMM);
  if (after) distances.push(candidateToSourceMM);
  for (const d of distances)
    assert.ok(
      Number.isFinite(d) && d >= 0 && d <= 0.02,
      "Native socket surface changed or opening filled",
    );
  return { driftMM: Math.max(0, ...distances), boundary: before !== after };
}
export function validateReceiverSocketEvidence(
  review,
  model,
  sourceHash,
  assets,
  nativeDatum,
  probes,
) {
  assert.ok(review, "Verify the final native socket surfaces");
  assert.equal(review.mode, "final");
  assert.equal(review.sourceSHA256, sourceHash);
  assert.equal(review.modelMountDepth, model.mountDepth);
  assert.equal(review.nativeDatumMM, nativeDatum);
  if (probes) {
    assert.equal(review.probeVersion, probes.version);
    assert.equal(review.probeSHA256, probes.sha256);
  }

  for (const tier of tiers) {
    const r = review.tiers[tier];
    assert.equal(r.sha256, assets[tier], "Socket QA resource changed");
    assert.ok(r.samples >= 100);
    if (probes) assert.equal(r.samples, probes.samples);
    if (probes?.cellSamples) assert.deepEqual(r.cellSamples, probes.cellSamples, "Socket coverage differs between cells");
    assert.equal(r.missingSurfaces, 0);
    assert.ok(
      Number.isFinite(r.maximumNativeDriftMM) &&
        r.maximumNativeDriftMM >= 0 &&
        r.maximumNativeDriftMM <= 0.02,
      "Native socket profile changed",
    );
  }
}
export function validateReceiverEvidence(
  model,
  sourceHash,
  record,
  assets,
  requiredProfiles,
) {
  assert.equal(model.tileType, "frame");
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.sourceCode, model.sourceCode);
  assert.equal(record.sourceSHA256, sourceHash);
  assert.deepEqual(record.reference, standard);
  const keys = record.profiles.map((p) => p.profile),
    expected = [standard.name, ...requiredProfiles].sort();
  assert.deepEqual(
    [...keys].sort(),
    expected,
    "Receiver profile coverage differs",
  );
  assert.equal(new Set(keys).size, keys.length);
  const final = record.final;
  assert.ok(final, "Verify the final receiving geometry before publication");
  assert.deepEqual(
    final.assets,
    assets,
    "Receiver resources changed after fit",
  );
  assert.equal(final.mountDepth, model.mountDepth);
  assert.deepEqual(
    final.supportSlots,
    model.supportSlots,
    "Receiver seating metadata changed",
  );
  assert.deepEqual(final.placementOffset, model.placementOffset);
  assert.equal(final.width, model.width);
  assert.equal(final.height, model.height);
  const cells = new Map();
  for (const c of record.cells) {
    const key = c.x + "," + c.y;
    assert.ok(!cells.has(key));
    assert.ok(
      Number.isInteger(c.x) &&
        Number.isInteger(c.y) &&
        c.x >= 0 &&
        c.y >= 0 &&
        c.x < model.width &&
        c.y < model.height,
    );
    assert.deepEqual(c.centerMM, [
      (c.x - (model.width - 1) / 2) * 35,
      ((model.height - 1) / 2 - c.y) * 35,
    ]);
    assert.deepEqual(Object.keys(c.seatsMM).sort(), [...keys].sort());
    cells.set(key, c);
  }
  const locations = new Map();
  for (const s of model.supportSlots)
    for (let y = s.y; y < s.y + s.height; y++)
      for (let x = s.x; x < s.x + s.width; x++) {
        const key = x + "," + y;
        assert.ok(cells.has(key), "Unmeasured receiver cell");
        assert.ok(!locations.has(key), "Overlapping receiving slots");
        locations.set(key, s);
      }
  assert.ok(locations.size > 0);
  const observed = new Set(),
    bias = record.nativeDatumMM - model.mountDepth * 35;
  assert.ok(Number.isFinite(bias));
  for (const f of final.fits) {
    const cell = f.x + "," + f.y,
      slot = locations.get(cell);
    assert.ok(
      slot &&
        keys.includes(f.profile) &&
        ["source", ...tiers].includes(f.receiverTier) &&
        rotations.includes(f.rotation),
    );
    const key = [cell, f.profile, f.receiverTier, f.rotation].join(":");
    assert.ok(!observed.has(key), "Duplicate receiving fit");
    observed.add(key);
    const rise =
      f.profile === standard.name
        ? slot.insertionRise
        : slot.insertionRises?.[f.profile];
    assert.ok(
      Number.isFinite(rise) && rise >= 0 && rise <= 0.15,
      "Invalid profile-specific receiving rise",
    );
    const seat = slot.elevation * 35 + bias + rise * 35;
    if (f.profile === standard.name) {
      assert.ok(Number.isFinite(record.sourceTopMM));
      assert.ok(
        seat + 0.000001 >= record.sourceTopMM + 0.02,
        "Ordinary body plane must remain above the receiving frame",
      );
    }

    for (const value of [f.minimumSeatMM, f.verifiedSeatMM, f.publishedSeatMM])
      assert.ok(Number.isFinite(value));
    assert.ok(
      Math.abs(seat - f.publishedSeatMM) < 0.00001,
      "Fit is bound to another support height",
    );
    assert.ok(
      Math.abs(f.verifiedSeatMM - f.minimumSeatMM - 0.02) < 0.00001,
      "Native clearance changed",
    );
    assert.ok(
      seat + 0.000001 >= f.verifiedSeatMM,
      "Receiving frame intersects its insertion",
    );
    assert.match(f.receiverGeometrySHA256, /^[a-f0-9]{64}$/);
  }
  assert.equal(
    observed.size,
    locations.size * keys.length * rotations.length * (tiers.length + 1),
    "Incomplete receiving fit coverage",
  );
  return record;
}
export function validateReceiverReferences(record, registry) {
  for (const p of record.profiles) {
    if (p.profile === standard.name) continue;
    const current = registry.find((m) => m.id === p.id);
    assert.ok(
      current,
      "Receiving reference is not registered: " + p.definitionId,
    );
    assert.equal(current.definitionId, p.definitionId);
    assert.equal(current.mountProfile, p.profile);
    assert.equal(current.assets.source.sha256, p.sourceSHA256);
    const metadata = {
      mountDepth: current.mountDepth,
      width: current.width,
      height: current.height,
      placementOffset: current.placementOffset,
    };
    assert.deepEqual(
      metadata,
      p.referenceMetadata,
      "Insertion reference placement changed",
    );
    assert.deepEqual(p.references.map((r) => r.tier).sort(), [...tiers].sort());
    for (const ref of p.references)
      assert.equal(
        current.assets[ref.tier].sha256,
        ref.sha256,
        "Insertion reference changed: " + p.definitionId + " " + ref.tier,
      );
  }
  return record;
}
export async function validateReceiverReport(report, directory, registry) {
  const code = report.model.sourceCode;
  assert.match(code, /^MT1-\d{3}$/);
  const file = path.join(
      import.meta.dirname,
      "receiver-frame-fits",
      code + ".json",
    ),
    record = JSON.parse(await fs.readFile(file, "utf8")),
    required = [];
  for (const name of await fs.readdir(
    path.join(import.meta.dirname, "recess-frame-fits"),
  ))
    if (name.endsWith(".json"))
      required.push(
        JSON.parse(
          await fs.readFile(
            path.join(import.meta.dirname, "recess-frame-fits", name),
            "utf8",
          ),
        ).profile,
      );
  const assets = {};
  for (const tier of tiers)
    assets[tier] = createHash("sha256")
      .update(await fs.readFile(path.join(directory, tier + ".glb")))
      .digest("hex");
  validateReceiverEvidence(
    report.model,
    report.sourceSHA256,
    record,
    assets,
    required,
  );
  validateReceiverSocketEvidence(
    report.receiverSocketReview,
    report.model,
    report.sourceSHA256,
    assets,
    record.nativeDatumMM,
    {
      version: record.socketProbeVersion,
      sha256: createHash("sha256")
        .update(JSON.stringify(record.socketProbes))
        .digest("hex"),
      samples: record.socketProbes.length,
      ...(record.socketProbeVersion >= 3 ? { cellSamples: socketProbeCellSamples(record.socketProbes, record.cells) } : {}),
    },
  );
  if (registry) validateReceiverReferences(record, registry);
  return record;
}
