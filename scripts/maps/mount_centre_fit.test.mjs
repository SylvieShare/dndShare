import test from "node:test";
import assert from "node:assert/strict";
import { assertReviewedMountCentreFit } from "./mount_centre_fit.mjs";

function fixture() {
  const sourceSHA256 = "a".repeat(64);
  const fit = {
    sourceSHA256,
    nativeCentresMM: [[-17.47371197, 0.01072979], [17.50179565, -0.01177502]],
    fittedCentresMM: [[-17.48595816, -0.000522615], [17.51404184, -0.000522615]],
    requiredDecodedCentreToleranceMM: 0.02,
  };
  const assets = Object.fromEntries(["render", "lod", "shadow"].map((tier, i) =>
    [tier, { sha256: String(i + 1).repeat(64) }]));
  return {
    assets,
    report: {
      sourceSHA256,
      recipe: { mountCentreFitReview: fit },
      mountCentreFitReview: {
        sourceSHA256,
        input: structuredClone(fit),
        tiers: Object.fromEntries(Object.entries(assets).map(([tier, asset]) =>
          [tier, { sha256: asset.sha256, maximumCoordinateDriftMM: 0.01228 }])),
      },
    },
  };
}

test("publication requires centre evidence for the exact source, fit and all three assets", () => {
  const { report, assets } = fixture();
  assert.doesNotThrow(() => assertReviewedMountCentreFit(report, assets));
  for (const change of [
    r => { delete r.mountCentreFitReview; },
    r => { r.mountCentreFitReview.sourceSHA256 = "b".repeat(64); },
    r => { r.mountCentreFitReview.input.nativeCentresMM[0][0] += 0.001; },
    ...["render", "lod", "shadow"].map(tier => r => {
      r.mountCentreFitReview.tiers[tier].sha256 = "f".repeat(64);
    }),
    r => { r.mountCentreFitReview.tiers.shadow.maximumCoordinateDriftMM = 0.02001; },
  ]) {
    const changed = structuredClone(report);
    change(changed);
    assert.throws(() => assertReviewedMountCentreFit(changed, assets));
  }
});

test("even a matching receipt cannot authorize a translated array or a wider tolerance", () => {
  for (const change of [
    fit => { fit.fittedCentresMM.forEach(p => { p[0] += 0.001; }); },
    fit => { fit.requiredDecodedCentreToleranceMM = 0.021; },
  ]) {
    const { report, assets } = fixture();
    change(report.recipe.mountCentreFitReview);
    report.mountCentreFitReview.input = structuredClone(report.recipe.mountCentreFitReview);
    assert.throws(() => assertReviewedMountCentreFit(report, assets));
  }
});

test("recipes with native centres do not require an array-fit receipt", () => {
  assert.doesNotThrow(() => assertReviewedMountCentreFit({ recipe: {} }, {}));
});
