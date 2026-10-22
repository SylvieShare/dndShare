import test from "node:test";
import assert from "node:assert/strict";
import { matchesPreparedPublication } from "./medieval_publication.mjs";
const prepared = {
  id: "stable",
  definitionId: "MT1-079",
  collection: "medieval-town-vol1",
  sourceCode: "MT1-079",
  sourceName: "Stair",
  name: "Stair",
  code: "MED-stair",
  textureDetail: "detailed",
  mountDepth: 0.153517,
  width: 1,
  height: 1,
  placementPoints: [{ x: 0.5, y: 0.5, elevation: 0.4 }],
  assets: { render: { sha256: "original" }, source: { sha256: "source" } },
};
test("fresh bilingual catalogue curation retains completed physical publication", () => {
  const current = {
    ...prepared,
    name: "Лестница",
    nameEn: "Stair",
    groupName: "Лестницы",
    groupNameEn: "Stairs",
    category: "stairs",
    code: "MED-new-section",
    variantCode: "MED-stair",
  };
  assert.equal(matchesPreparedPublication(prepared, current), true);
});
test("explicit logical cells retain painting while physical contacts stay strict", () => {
  const current = { ...prepared, placementPoints: prepared.placementPoints.map(p => ({ ...p, cell: { x: 0, y: 0 } })) };
  assert.equal(matchesPreparedPublication(prepared, current), true);
  assert.equal(matchesPreparedPublication(current, { ...current, placementPoints: [{ ...current.placementPoints[0], elevation: .5 }] }), false);
  for (const cell of [null, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: .5 }]) {
    assert.equal(matchesPreparedPublication(prepared, { ...current, placementPoints: [{ ...current.placementPoints[0], cell }] }), false);
  }
});
test("identity, source, resource and placement changes are never hidden by catalogue comparison", () => {
  for (const changed of [
    { id: "different" },
    { definitionId: "other" },
    { mountDepth: 0.3 },
    { placementPoints: [{ x: 0.2, y: 0.5, elevation: 0.4 }] },
    { assets: { ...prepared.assets, render: { sha256: "changed" } } },
    { assets: { ...prepared.assets, source: { sha256: "changed" } } },
    { textureDetail: "basic" },
  ])
    assert.equal(
      matchesPreparedPublication(prepared, { ...prepared, ...changed }),
      false,
    );
});
