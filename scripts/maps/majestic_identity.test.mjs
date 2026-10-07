import assert from "node:assert/strict";
import test from "node:test";
import { confirmedMajesticModel } from "./majestic_identity.mjs";

const prepared = {
  id: "resource-version",
  sourceCode: "MH-031",
  sourceName: "Lit Campfire",
  version: 1,
  width: 3,
  mountDepth: 0.28,
  assets: { render: { sha256: "verified-render", size: 100 } },
};
const registered = {
  ...prepared,
  definitionId: "MH-031",
  code: "MH-campfire",
};

test("adopts assigned identity and current shared group without rewriting assets", () => {
  assert.equal(confirmedMajesticModel(prepared, registered), registered);
  assert.equal(
    confirmedMajesticModel(
      { ...registered, code: "MH-lit-campfire" },
      registered,
    ),
    registered,
  );
});

test("rejects changed resources, placement, source or logical identity", () => {
  for (const mutation of [
    { width: 4 },
    { mountDepth: 0.3 },
    { sourceName: "Unlit Campfire" },
    { id: "another-resource-version" },
    { assets: { render: { sha256: "other-render", size: 100 } } },
  ])
    assert.throws(() =>
      confirmedMajesticModel(prepared, { ...registered, ...mutation }),
    );
  assert.throws(() =>
    confirmedMajesticModel(registered, {
      ...registered,
      definitionId: "MH-032",
    }),
  );
  assert.throws(() =>
    confirmedMajesticModel(prepared, { ...registered, code: "UD-campfire" }),
  );
  assert.throws(() => confirmedMajesticModel(prepared, prepared));
});
