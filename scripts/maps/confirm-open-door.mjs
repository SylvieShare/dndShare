import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import specs from "./open-doors.json" with { type: "json" };
const code = process.argv[2],
  snapshot = process.argv[3];
if (!specs[code] || !snapshot)
  throw new Error("Reviewed base code and fresh snapshot required");
const base = path.resolve(
    import.meta.dirname,
    "../../models/collections/open-doors",
  ),
  dir = path.join(base, specs[code].code),
  packet = JSON.parse(
    await fs.readFile(path.join(dir, "upload/catalogue.json"), "utf8"),
  );
assert.equal(packet.length, 1);
const model = packet[0],
  rows = JSON.parse(await fs.readFile(snapshot, "utf8")),
  latest = rows.filter(
    (m) =>
      m.collection === model.collection && m.sourceCode === model.sourceCode,
  )[0];
assert.deepEqual(
  latest,
  model,
  "Registered model differs from reviewed variant",
);
const report = JSON.parse(
    await fs.readFile(path.join(dir, "report.json"), "utf8"),
  ),
  parent = JSON.parse(
    await fs.readFile(path.join(dir, "geometry-report.json"), "utf8"),
  ).parent;
assert.deepEqual(
  rows.find((m) => m.id === parent.id),
  parent,
  "Closed parent changed",
);
report.publication = {
  id: model.id,

  verifiedAt: new Date().toISOString(),
};
await fs.writeFile(
  path.join(dir, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
await fs.writeFile(
  path.join(base, "registry-snapshot.json"),
  JSON.stringify(
    rows.filter((m) => m.collection === model.collection),
    null,
    2,
  ) + "\n",
  { mode: 0o600 },
);
console.log(
  "OPEN_DOOR_CONFIRMED",
  model.sourceCode,
  model.id,
  model.assets.render.sha256.slice(0, 12),
  "five resources; closed parent retained",
);
