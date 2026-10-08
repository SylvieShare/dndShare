import test from "node:test";
import assert from "node:assert/strict";
import { assertModelBaseline } from "./toxic_sewer_baseline.mjs";

test("constant model UUID still detects changed resources and placement", () => {
  const current = {
    id: "stable",
    assets: { render: { sha256: "old", size: 123 } },
    mountDepth: 0.2,
    textureDetail: "basic",
  };
  const prepared = { ...current, textureDetail: "detailed" };
  assertModelBaseline(prepared, current);
  assert.throws(() =>
    assertModelBaseline(prepared, {
      ...current,
      assets: { render: { sha256: "new", size: 123 } },
    }),
  );
  assert.throws(() =>
    assertModelBaseline(prepared, { ...current, mountDepth: 0.3 }),
  );
});
