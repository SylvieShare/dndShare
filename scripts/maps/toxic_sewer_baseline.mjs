import assert from "node:assert/strict";

// The prepared report sets the intended detail level before painting.
export function assertModelBaseline(prepared, current) {
  const baseline = { ...prepared };
  const latest = { ...current };
  delete baseline.textureDetail;
  delete latest.textureDetail;
  assert.deepEqual(
    latest,
    baseline,
    "Accepted assets or placement changed during preparation; refresh the baseline",
  );
}
