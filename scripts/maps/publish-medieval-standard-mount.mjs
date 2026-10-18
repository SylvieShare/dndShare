import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify, isDeepStrictEqual } from "node:util";
import { mapTool } from "./mcp_maps_client.mjs";
import {
  STANDARD_MOUNT,
  standardMountMetadata,
  validateStandardMount,
  verifyStandardMountBody,
} from "./standard_mount.mjs";
const run = promisify(execFile),
  root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections/medieval-town-vol1"),
  code = process.argv[2];
assert.match(code ?? "", /^MT1-\d{3}$/);
const dir = path.join(base, "mount-standard", code),
  upload = path.join(dir, "upload"),
  file = path.join(dir, "report.json"),
  r = JSON.parse(await fs.readFile(file, "utf8")),
  expected = JSON.parse(
    await fs.readFile(path.join(upload, "catalogue.json"), "utf8"),
  )[0];
assert.equal(r.recipe, "medieval-ud016-mount-v1");
assert.deepEqual(expected, r.model);
const withoutAssets = (m) => {
  const { assets, ...rest } = m;
  return rest;
};
assert.deepEqual(
  withoutAssets(expected),
  withoutAssets(standardMountMetadata(r.originalModel)),
);
assert.deepEqual(expected.assets.source, r.originalModel.assets.source);
for (const kind of ["render", "lod", "shadow", "preview", "source"]) {
  const a = expected.assets[kind],
    bytes = await fs.readFile(path.join(upload, path.basename(a.key)));
  assert.equal(bytes.length, a.size);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), a.sha256);
}
for (const tier of ["render", "lod"]) {
  const before = await fs.readFile(path.join(dir, "input-" + tier + ".glb")),
    after = await fs.readFile(path.join(dir, tier + ".glb"));
  assert.equal(
    createHash("sha256").update(before).digest("hex"),
    r.originalModel.assets[tier].sha256,
  );
  assert.equal(
    createHash("sha256").update(after).digest("hex"),
    expected.assets[tier].sha256,
  );
  await validateStandardMount(after, expected);
  await verifyStandardMountBody(before, after, r.originalModel, expected);
}
const current = await mapTool("map_tile_model_get", { id: expected.id }),
  already = isDeepStrictEqual(current, expected);
if (!already)
  assert.deepEqual(
    current,
    r.originalModel,
    "Current model changed after preparation",
  );
const behaviourBefore = (
  await mapTool("map_tile_model_behaviour_get", {
    definitionId: expected.definitionId,
  })
).behaviour;
if (!already) {
  const checkRoot = process.env.DNDSHARE_MAP_REVIEW_ROOT;
  assert.ok(
    checkRoot,
    "Set a checked clean Go checkout for manifest validation",
  );
  const check = await run(
    "go",
    [
      "-C",
      checkRoot,
      "test",
      "./internal/web",
      "-run",
      "TestPreparedCollectionManifest",
      "-count=1",
      "-v",
    ],
    {
      env: {
        ...process.env,
        GOCACHE: process.env.GOCACHE ?? "/private/tmp/dndshare-go-cache",
        MAP_MODEL_MANIFEST: path.join(upload, "catalogue.json"),
        MAP_MODEL_PREVIOUS_MANIFEST: path.join(dir, "previous-catalogue.json"),
        MAP_MODEL_GEOMETRY_CORRECTION: "1",
        MAP_MODEL_NEW_SOURCE: "0",
        MAP_MODEL_CORRECTION_REASON: r.geometryCorrection.reason,
      },
      maxBuffer: 1048576,
    },
  );
  process.stdout.write(check.stdout);
  const uploader = process.env.DNDSHARE_MAP_UPLOADER;
  assert.ok(uploader, "Use the checked map-model uploader binary");
  const result = await run(uploader, ["-assets", upload, "-workers", "1"], {
    cwd: root,
    maxBuffer: 1048576,
  });
  if (result.stderr) process.stdout.write(result.stderr);
}
assert.deepEqual(
  await mapTool("map_tile_model_get", { id: expected.id }),
  expected,
);
const behaviourAfter = (
  await mapTool("map_tile_model_behaviour_get", {
    definitionId: expected.definitionId,
  })
).behaviour;
assert.deepEqual(
  behaviourAfter,
  behaviourBefore,
  "Geometry correction changed lights, animation or transitions",
);
const registry = await mapTool("map_tile_models_list");
assert.deepEqual(
  registry.find((m) => m.id === expected.id),
  expected,
);
await fs.writeFile(
  path.join(base, "registry-snapshot.json"),
  JSON.stringify(registry, null, 2) + "\n",
  { mode: 0o600 },
);
const confirmedAt = new Date().toISOString();
r.publication = {
  confirmedAt,
  uuid: expected.id,
  definitionId: expected.definitionId,
  assetsVerified: true,
  placementVerified: true,
  behaviourVerified: true,
};
r.behaviourPublication = {
  confirmedAt,
  definitionId: expected.definitionId,
  ...behaviourAfter,
};
await fs.writeFile(file, JSON.stringify(r, null, 2) + "\n");
// Keep the original painting evidence accurate; add an explicit later mounting correction.
const paint = JSON.parse(
  await fs.readFile(path.join(dir, "source-paint-report.json"), "utf8"),
);
paint.model = expected;
paint.publication = r.publication;
paint.behaviourPublication = r.behaviourPublication;
paint.mountStandardCorrection = {
  confirmedAt,
  profile: STANDARD_MOUNT.name,
  originalModel: r.originalModel,
  tiers: r.tiers,
  nativeFrameFit: r.nativeFrameFit,
  behaviourUnchanged: true,
};
for (const tier of ["render", "lod", "shadow"])
  paint.tiers[tier] = {
    ...paint.tiers[tier],
    bytes: expected.assets[tier].size,
    ...(tier === "shadow"
      ? { triangles: r.tiers.shadow.triangles, bounds: r.tiers.shadow.bounds }
      : {
          bounds: {
            min: paint.tiers[tier].bounds.min.map((v, i) =>
              i === 1
                ? v + STANDARD_MOUNT.depth - r.originalModel.mountDepth
                : v,
            ),
            max: paint.tiers[tier].bounds.max.map((v, i) =>
              i === 1
                ? v + STANDARD_MOUNT.depth - r.originalModel.mountDepth
                : v,
            ),
          },
        }),
  };
paint.runtimeBytes = ["render", "lod", "shadow", "preview"].reduce(
  (n, k) => n + expected.assets[k].size,
  0,
);
const canonical = path.join(base, "upload", code);
await fs.mkdir(canonical, { recursive: true });
for (const asset of Object.values(expected.assets))
  await fs.copyFile(
    path.join(upload, path.basename(asset.key)),
    path.join(canonical, path.basename(asset.key)),
  );
await fs.writeFile(
  path.join(canonical, "catalogue.json"),
  JSON.stringify([expected], null, 2) + "\n",
);
for (const name of [
  "render.glb",
  "lod.glb",
  "shadow.glb",
  "preview-model.glb",
  "lod-preview-model.glb",
  "preview.webp",
  "transparent-preview.png",
])
  await fs.copyFile(
    path.join(dir, name),
    path.join(base, "review", code, name),
  );
await fs.copyFile(
  path.join(dir, "transparent-preview.png"),
  path.join(base, "review", code, "preview.png"),
);
await fs.writeFile(
  path.join(base, "review", code, "report.json"),
  JSON.stringify(paint, null, 2) + "\n",
);
assert.deepEqual(
  JSON.parse(await fs.readFile(path.join(canonical, "catalogue.json"), "utf8")),
  [expected],
);
const inventory = JSON.parse(
    await fs.readFile(path.join(base, "inventory.json"), "utf8"),
  ),
  progress = [],
  standard = [];
for (const row of inventory) {
  const p = JSON.parse(
      await fs
        .readFile(path.join(base, "review", row.code, "report.json"), "utf8")
        .catch(() => "{}"),
    ),
    m = registry.find(
      (m) => m.sourceCode === row.code && m.collection === row.collection,
    ),
    published = !!(
      m &&
      p.publication?.assetsVerified &&
      isDeepStrictEqual(p.model, m)
    );
  progress.push({
    code: row.code,
    sourceName: row.sourceName,
    status: published ? "published" : "pending",
    uuid: published ? m.id : null,
  });
  if (published)
    standard.push({
      code: row.code,
      uuid: m.id,
      status:
        p.mountStandardCorrection?.profile === STANDARD_MOUNT.name &&
        m.mountDepth === STANDARD_MOUNT.depth
          ? "verified"
          : "pending",
      mountDepth: m.mountDepth,
    });
}
await fs.writeFile(
  path.join(base, "progress.json"),
  JSON.stringify(progress, null, 2) + "\n",
);
await fs.writeFile(
  path.join(base, "mount-standard-progress.json"),
  JSON.stringify(standard, null, 2) + "\n",
);
const wikiPath = path.join(root, "md/features/medieval-town.md");
const wiki = await fs.readFile(wikiPath, "utf8"),
  line = wiki.split("\n").find((l) => l.startsWith("| " + code + " "));
if (line) {
  let note = line
    .split("|")[3]
    .trim()
    .replace(/mount (?:10|17) мм/g, "монтаж UD-016");
  if (!note.includes("Монтаж UD-016:"))
    note += " Монтаж UD-016: 5,373 мм; покраска и положение тела сохранены.";
  await run(
    "node",
    ["scripts/maps/record-medieval-wiki.mjs", code, "--note=" + note],
    { cwd: root, maxBuffer: 1048576 },
  );
}
const standardized = standard.filter(
  (r) => r.status === "verified" && Number(r.code.slice(4)) <= 70,
).length;
await fs.writeFile(
  wikiPath,
  (await fs.readFile(wikiPath, "utf8")).replace(
    /Монтаж UD-016 подтверждён у \d+ из 70 опубликованных моделей\./,
    `Монтаж UD-016 подтверждён у ${standardized} из 70 опубликованных моделей.`,
  ),
);
console.log(
  "MEDIEVAL_STANDARD_PUBLISHED",
  code,
  expected.id,
  expected.mountDepth,
  r.tiers.render.pads,
  standard.filter((r) => r.status === "verified").length,
  "/",
  standard.length,
);
