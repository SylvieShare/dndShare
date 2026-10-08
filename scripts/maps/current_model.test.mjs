import { test } from "node:test";
import assert from "node:assert/strict";
import { currentModel } from "./current_model.mjs";
test("publishing new geometry retains current UUID and shared family", () => {
  const current = {
    collection: "ud",
    sourceCode: "UD-010",
    sourceName: "Door",
    id: "stable",
    definitionId: "UD-010",
    code: "UD-door",
    hidden: false,
  };
  const result = currentModel(
    { ...current, id: "old-revision", version: 9 },
    [current],
    { render: { sha256: "new" } },
  );
  assert.equal(result.id, "stable");
  assert.equal(result.code, "UD-door");
  assert.equal(result.version, undefined);
  assert.equal(result.assets.render.sha256, "new");
});
test("new variants get their own UUID, reused for an unregistered retry", () => {
  const first = currentModel(
    { collection: "ud", sourceCode: "UD-010-OPEN", sourceName: "Door open" },
    [],
    {},
  );
  assert.match(first.id, /^[0-9a-f-]{36}$/);
  assert.equal(currentModel(first, [], {}).id, first.id);
});
