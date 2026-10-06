import test from "node:test";
import assert from "node:assert/strict";
import {
  includePreparedVariant,
  preservedRevisionAssets,
} from "./prepared_revision.mjs";
test("two cached inputs of one variant cannot enter one publication packet", () => {
  const seen = new Set(),
    model = {
      collection: "ultimate-dungeon",
      sourceCode: "UD-087",
      sourceName: "Column Skulls",
    };
  includePreparedVariant(seen, { ...model, version: 5 });
  assert.throws(
    () => includePreparedVariant(seen, { ...model, version: 6 }),
    /More than one/,
  );
});
test("duplicate textual codes with different source names remain distinct variants", () => {
  const seen = new Set();
  for (const sourceName of ["Prison Cell Wall", "Prison Cell Angle"])
    includePreparedVariant(seen, {
      collection: "ultimate-dungeon",
      sourceCode: "UD-055",
      sourceName,
    });
  assert.equal(seen.size, 2);
});
test("visual revisions retain the verified source and shadow references", () => {
  const source = { sha256: "source" },
    shadow = { sha256: "shadow" },
    assets = preservedRevisionAssets({ assets: { source, shadow } });
  assert.equal(assets.source, source);
  assert.equal(assets.shadow, shadow);
  assert.throws(
    () => preservedRevisionAssets({ assets: { source } }),
    /shadow asset is required/,
  );
});
