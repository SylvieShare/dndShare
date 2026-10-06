import fs from "node:fs/promises";
import path from "node:path";
const file = process.argv[2],
  name = process.argv[3],
  reason = process.argv[4];
if (
  !file ||
  !["original", "albedo-1536-768", "albedo-1536-768-roughness4"].includes(
    name,
  ) ||
  !reason
)
  throw new Error(
    "Report, reviewed candidate and explicit selection reason required",
  );
const directory = path.dirname(path.resolve(file)),
  candidate = path.join(directory, "candidates", name),
  report = JSON.parse(
    await fs.readFile(path.join(candidate, "report.json"), "utf8"),
  );
report.optimization = {
  ...report.optimization,
  candidate: name,
  selection: reason,
};
for (const entry of [
  "render.glb",
  "lod.glb",
  "preview-model.glb",
  "lod-preview-model.glb",
  "preview.png",
  "top.png",
  "reverse.png",
  "lod-preview.png",
  "lod-top.png",
  "lod-reverse.png",
]) {
  const target = path.join(directory, entry);
  await fs.copyFile(path.join(candidate, entry), target + ".next");
  await fs.rename(target + ".next", target);
}
await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
console.log(
  "SELECTED",
  report.model.sourceCode,
  name,
  report.tiers.render.bytes,
  report.tiers.lod.bytes,
);
