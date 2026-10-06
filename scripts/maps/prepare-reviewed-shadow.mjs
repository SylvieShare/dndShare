import fs from "node:fs/promises";
import path from "node:path";
import { prepareShadow } from "./shadow_model.mjs";
const file = process.argv[2];
if (!file) throw new Error("One reviewed report required");
const report = JSON.parse(await fs.readFile(file, "utf8"));
const directory = path.dirname(path.resolve(file));
const temporary = path.join(directory, "shadow-next.glb");
const prepared = await prepareShadow(
  path.join(directory, "lod.glb"),
  temporary,
);
await fs.rename(
  temporary,
  path.join(directory, prepared.asset.sha256 + ".glb"),
);
report.preparedShadow = prepared;
await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
console.log(
  "REVIEWED_SHADOW",
  report.model.sourceCode,
  prepared.asset.size,
  prepared.triangles,
);
