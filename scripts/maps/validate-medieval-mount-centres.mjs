import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { reviewSelectedMountCentreFit } from "./mount_centre_fit.mjs";

const code = process.argv[2];
assert.match(code ?? "", /^MT1-\d{3}$/);
const directory = path.resolve(import.meta.dirname, "../../models/collections/medieval-town-vol1/review", code);
const file = path.join(directory, "report.json"), report = JSON.parse(await fs.readFile(file, "utf8"));
report.mountCentreFitReview = await reviewSelectedMountCentreFit(directory, report);
await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
console.log("MEDIEVAL_MOUNT_CENTRES_CONFIRMED", code, Object.fromEntries(
  Object.entries(report.mountCentreFitReview.tiers).map(([tier, value]) => [tier, value.maximumCoordinateDriftMM]),
));
