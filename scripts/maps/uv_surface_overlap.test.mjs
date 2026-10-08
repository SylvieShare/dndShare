import test from "node:test";
import assert from "node:assert/strict";
import { uvSurfaceTracker } from "./uv_surface_overlap.mjs";
test("UV atlas accepts shared edges but rejects a wall overwriting a distant crystal face", () => {
  const track = uvSurfaceTracker(4, 4);
  track(6, [9.652, 6.0185, 23.4915]);
  track(6, [9.66, 6.02, 23.5]);
  assert.throws(
    () => track(6, [3.4327, 5.6122, 23.2992]),
    /Overlapping UV surfaces/,
  );
  track(7, [3.4327, 5.6122, 23.2992]);
  assert.throws(() => uvSurfaceTracker(4, 4, 0));
});
