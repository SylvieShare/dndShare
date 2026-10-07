import test from "node:test";
import assert from "node:assert/strict";
import { reviewCollection, requestedCollection } from "./review_collection.mjs";
test("Lost Cave snapshots and review journals cannot overwrite Ultimate Dungeon state", () => {
  const ud = reviewCollection(),
    lc = requestedCollection(["--collection=lost-cave"]);
  assert.notEqual(lc.snapshot, ud.snapshot);
  assert.notEqual(lc.detail, ud.detail);
  assert.ok(lc.snapshot.endsWith("lost-cave/registry-snapshot.json"));
  assert.ok(lc.detail.endsWith("lost-cave/detailed"));
  assert.throws(() => reviewCollection("../ultimate-dungeon"), /Unsupported/);
});
test("Toxic Sewer has a separate registry and processing journal", () => {
  const ts = requestedCollection(["--collection=toxic-sewer"]);
  for (const name of ["ultimate-dungeon", "lost-cave"]) {
    const other = reviewCollection(name);
    assert.notEqual(ts.snapshot, other.snapshot);
    assert.notEqual(ts.detail, other.detail);
  }
  assert.ok(ts.detail.endsWith("toxic-sewer/detailed"));
});
