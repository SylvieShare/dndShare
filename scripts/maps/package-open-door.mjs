import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import specs from "./open-doors.json" with { type: "json" };
import { openDoorModel } from "./open-door-model.mjs";
import { prepareDoorTier } from "./open-door-assets.mjs";
const code = process.argv[2],
  spec = specs[code];
if (!spec) throw new Error("One reviewed base door code required");
const base = path.resolve(
    import.meta.dirname,
    "../../models/collections/open-doors",
  ),
  directory = path.join(base, spec.code),
  geometry = JSON.parse(
    await fs.readFile(path.join(directory, "geometry-report.json"), "utf8"),
  );
const source = await fs.readFile(path.join(directory, "render-raw.glb")),
  sha256 = createHash("sha256").update(source).digest("hex");
const asset = {
  key: "map-models/" + sha256 + ".glb",
  sha256,
  size: source.length,
  mimeType: "model/gltf-binary",
  fileName: spec.code + "-source.glb",
};
await fs.writeFile(path.join(directory, sha256 + ".glb"), source);
const model = openDoorModel(geometry.parent, spec);
model.assets.source = asset;
const report = {
  model,
  recipe: "ultimate-open-door-v1",
  weightBudget: spec.weightBudget,
  provenance: {
    id: geometry.parent.id,
    code,
    source: geometry.parent.assets.source,
    angle: spec.angle,
    hinge: spec.hinge,
  },
  geometry: geometry.tiers,
  tiers: {},
};
for (const tier of ["render", "lod"])
  report.tiers[tier] = await prepareDoorTier(
    path.join(directory, tier + "-raw.glb"),
    path.join(directory, tier + ".glb"),
    path.join(
      directory,
      tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
    ),
    tier === "render" ? 2048 : 1024,
  );
await fs.writeFile(
  path.join(directory, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
for (const [name, step] of [
  ["albedo-1536-768", 1],
  ["albedo-1536-768-roughness4", 4],
]) {
  const dir = path.join(directory, "candidates", name);
  await fs.mkdir(dir, { recursive: true });
  const copy = structuredClone(report);
  copy.optimization = {
    candidate: name,
    selection: "pending visual comparison",
    baseline: report.tiers,
    geometry: "same cut meshes and rigid transformation",
    normal: "unchanged",
    orm:
      step === 1
        ? "unchanged"
        : "AO and metallic unchanged; roughness step4/255",
  };
  for (const tier of ["render", "lod"])
    copy.tiers[tier] = await prepareDoorTier(
      path.join(directory, tier + "-raw.glb"),
      path.join(dir, tier + ".glb"),
      path.join(
        dir,
        tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
      ),
      tier === "render" ? 1536 : 768,
      step,
    );
  await fs.writeFile(
    path.join(dir, "report.json"),
    JSON.stringify(copy, null, 2) + "\n",
  );
  console.log("OPEN_DOOR_CANDIDATE", spec.code, name, copy.tiers);
}
const original = path.join(directory, "candidates/original");
await fs.mkdir(original, { recursive: true });
for (const name of [
  "report.json",
  "render.glb",
  "lod.glb",
  "preview-model.glb",
  "lod-preview-model.glb",
])
  await fs.copyFile(path.join(directory, name), path.join(original, name));
console.log("OPEN_DOOR_BASE", spec.code, report.tiers);
