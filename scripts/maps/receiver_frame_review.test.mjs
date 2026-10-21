import test from "node:test";
import assert from "node:assert/strict";
import standard from "./standard-mount-profile.json" with { type: "json" };
import {
  validateReceiverEvidence,
  validateReceiverReferences,
  validateReceiverSocketEvidence,
  validateReceiverRayDrift,
  refreshReceiverSupportSlots,
} from "./receiver_frame_review.mjs";
const recess = "ud016-recess-mt1-080-v1",
  assets = {
    render: "a".repeat(64),
    lod: "b".repeat(64),
    shadow: "c".repeat(64),
  };
function fixture() {
  const slot = {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      elevation: 0.833492,
      insertionRise: 0.025,
      insertionRises: { [recess]: 0.03 },
    },
    model = {
      sourceCode: "MT1-086",
      tileType: "frame",
      width: 1,
      height: 1,
      mountDepth: standard.depth,
      placementOffset: [0, 0],
      supportSlots: [slot],
    },
    source = "f".repeat(64),
    child = {
      id: "reference",
      definitionId: "MT1-080",
      mountProfile: recess,
      mountDepth: standard.depth,
      width: 1,
      height: 1,
      placementOffset: [0, 0],
      assets: {
        source: { sha256: "d".repeat(64) },
        ...Object.fromEntries(
          Object.entries(assets).map(([k, v]) => [k, { sha256: v }]),
        ),
      },
    },
    profiles = [
      { profile: standard.name },
      {
        profile: recess,
        id: child.id,
        definitionId: child.definitionId,
        sourceSHA256: child.assets.source.sha256,
        referenceMetadata: {
          mountDepth: child.mountDepth,
          width: 1,
          height: 1,
          placementOffset: [0, 0],
        },
        references: Object.entries(assets).map(([tier, sha256]) => ({
          tier,
          sha256,
        })),
      },
    ],
    fits = [];
  for (const p of profiles)
    for (const receiverTier of ["source", "render", "lod", "shadow"])
      for (const rotation of [0, 90, 180, 270]) {
        const rise =
            p.profile === standard.name
              ? slot.insertionRise
              : slot.insertionRises[p.profile],
          seat = slot.elevation * 35 + 17 - model.mountDepth * 35 + rise * 35;
        fits.push({
          x: 0,
          y: 0,
          profile: p.profile,
          receiverTier,
          rotation,
          minimumSeatMM: seat - 0.04,
          verifiedSeatMM: seat - 0.02,
          publishedSeatMM: seat,
          receiverGeometrySHA256: "e".repeat(64),
        });
      }
  const record = {
    schemaVersion: 1,
    sourceCode: model.sourceCode,
    sourceSHA256: source,
    reference: standard,
    nativeDatumMM: 17,
    sourceTopMM: 40.8,
    profiles,
    cells: [
      {
        x: 0,
        y: 0,
        centerMM: [0, 0],
        seatsMM: { [standard.name]: 41.65, [recess]: 41.82 },
      },
    ],
    final: {
      assets: structuredClone(assets),
      mountDepth: model.mountDepth,
      supportSlots: structuredClone(model.supportSlots),
      placementOffset: [0, 0],
      width: 1,
      height: 1,
      fits,
    },
  };
  return { model, source, record, child };
}
const check = (f) =>
  validateReceiverEvidence(f.model, f.source, f.record, assets, [recess]);

test("a new recess fit refreshes only seating and retains earlier clearances", () => {
  const { model, record } = fixture();
  record.quantizationReserveMM = 0.02;
  const before = structuredClone(model),
    next = "ud016-recess-mt1-088-v1";
  const extra = record.final.fits
    .filter((f) => f.profile === recess)
    .map((f) => ({
      ...f,
      profile: next,
      verifiedSeatMM: f.verifiedSeatMM + 0.25,
    }));
  record.profiles.push({ profile: next });
  const fits = [...record.final.fits, ...extra];
  refreshReceiverSupportSlots(model, record, fits);
  const { insertionRises, ...slot } = model.supportSlots[0];
  assert.deepEqual(
    slot,
    (({ insertionRises, ...rest }) => rest)(before.supportSlots[0]),
  );
  assert.equal(
    insertionRises[recess],
    before.supportSlots[0].insertionRises[recess],
  );
  const bias = record.nativeDatumMM - model.mountDepth * 35;
  const declared =
    model.supportSlots[0].elevation * 35 + bias + insertionRises[next] * 35;
  assert.ok(declared >= Math.max(...extra.map((f) => f.verifiedSeatMM)) + 0.02);
  const stable = structuredClone(model);
  refreshReceiverSupportSlots(model, record, fits);
  assert.deepEqual(model, stable);
  assert.throws(() =>
    refreshReceiverSupportSlots(model, record, fits.slice(1)),
  );
  assert.throws(() =>
    refreshReceiverSupportSlots(
      model,
      record,
      fits.map((f) => ({ ...f, verifiedSeatMM: 1000 })),
    ),
  );
});
test("receiver evidence covers the source,three meshes,all profiles and cardinal rotations", () => {
  const f = fixture();
  assert.equal(check(f), f.record);
  assert.equal(validateReceiverReferences(f.record, [f.child]), f.record);
  f.child.name = "Curated label";
  validateReceiverReferences(f.record, [f.child]);
});
test("receiver rejects missing rotations,duplicate fits and stale geometry or metadata", () => {
  for (const mutate of [
    (f) => f.record.final.fits.pop(),
    (f) => (f.record.final.fits[1] = structuredClone(f.record.final.fits[0])),
    (f) => (f.record.final.assets.lod = "0".repeat(64)),
    (f) => (f.model.placementOffset[0] = 0.1),
    (f) => (f.model.supportSlots[0].insertionRise = 0.026),
    (f) => (f.record.cells[0].centerMM = [35, 0]),
    (f) => f.record.profiles.pop(),
    (f) => (f.record.sourceSHA256 = "0".repeat(64)),
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => check(f));
  }
});
test("receiver rejects actual contact beyond its declared support height", () => {
  const f = fixture(),
    fit = f.record.final.fits[0];
  fit.minimumSeatMM = fit.publishedSeatMM + 0.01;
  fit.verifiedSeatMM = fit.minimumSeatMM + 0.02;
  assert.throws(() => check(f), /intersects/);
});
test("fresh registry must retain insertion geometry and placement metadata", () => {
  for (const mutate of [
    (f) => (f.child.assets.render.sha256 = "0".repeat(64)),
    (f) => (f.child.mountDepth = 0.4),
    (f) => (f.child.mountProfile = "another"),
    (f) => (f.child.definitionId = "MT1-082"),
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => validateReceiverReferences(f.record, [f.child]));
  }
  const f = fixture();
  f.record.profiles[1].referenceStage = "prepared";
  assert.throws(() => validateReceiverReferences(f.record, []));
  assert.doesNotThrow(() => validateReceiverReferences(f.record, [f.child]));
});

test("socket QA remains bound to the final coordinate transform and resources", () => {
  const f = fixture(),
    review = {
      mode: "final",
      sourceSHA256: f.source,
      nativeDatumMM: 17,
      modelMountDepth: f.model.mountDepth,
      tiers: Object.fromEntries(
        Object.entries(assets).map(([tier, sha256]) => [
          tier,
          {
            sha256,
            samples: 280,
            missingSurfaces: 0,
            maximumNativeDriftMM: 0.009,
          },
        ]),
      ),
    };
  validateReceiverSocketEvidence(review, f.model, f.source, assets, 17);
  for (const mutate of [
    (r) => (r.mode = "native"),
    (r) => (r.modelMountDepth = 0.485714),
    (r) => (r.tiers.lod.sha256 = "0".repeat(64)),
    (r) => (r.tiers.shadow.maximumNativeDriftMM = 0.021),
    (r) => (r.tiers.render.missingSurfaces = 1),
  ]) {
    const bad = structuredClone(review);
    mutate(bad);
    assert.throws(() =>
      validateReceiverSocketEvidence(bad, f.model, f.source, assets, 17),
    );
  }
});

test("sub-millimetre edge-ray changes retain the native tolerance and never accept a filled cavity", () => {
  assert.deepEqual(validateReceiverRayDrift(true, false, 0.00075, null), {
    driftMM: 0.00075,
    boundary: true,
  });
  assert.deepEqual(validateReceiverRayDrift(false, true, null, 0.009), {
    driftMM: 0.009,
    boundary: true,
  });
  assert.throws(() => validateReceiverRayDrift(false, true, null, 13));
  assert.throws(() => validateReceiverRayDrift(true, false, 0.021, null));
  assert.throws(() => validateReceiverRayDrift(true, true, 0.001, 2));
});

test("socket proof cannot be reused after the required probe set changes", () => {
  const f = fixture(),
    probes = { version: 2, sha256: "a".repeat(64), samples: 709 },
    review = {
      mode: "final",
      sourceSHA256: f.source,
      nativeDatumMM: 17,
      modelMountDepth: f.model.mountDepth,
      probeVersion: 2,
      probeSHA256: probes.sha256,
      tiers: Object.fromEntries(
        Object.entries(assets).map(([tier, sha256]) => [
          tier,
          {
            sha256,
            samples: 709,
            missingSurfaces: 0,
            maximumNativeDriftMM: 0.007,
          },
        ]),
      ),
    };
  validateReceiverSocketEvidence(review, f.model, f.source, assets, 17, probes);
  assert.throws(() =>
    validateReceiverSocketEvidence(review, f.model, f.source, assets, 17, {
      ...probes,
      sha256: "b".repeat(64),
    }),
  );
  assert.throws(() =>
    validateReceiverSocketEvidence(review, f.model, f.source, assets, 17, {
      ...probes,
      samples: 710,
    }),
  );
});

test("single-cell ordinary insertion also clears frame geometry above the peg footprint", () => {
  const f = fixture();
  f.record.sourceTopMM = 45;
  assert.throws(() => check(f), /above the receiving frame/);
});
