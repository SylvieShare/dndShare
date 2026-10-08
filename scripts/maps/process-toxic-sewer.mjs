// One model per invocation. Publication requires an explicit visual review note.
import fs from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mapTool } from "./mcp_maps_client.mjs";
import { transparentPreview } from "./preview_image.mjs";
import specs from "./toxic_sewer_recipes.mjs";
const root = path.resolve(import.meta.dirname, "../..");
const base = path.join(root, "models/collections/toxic-sewer");
const code = process.argv[2],
  mode = process.argv[3];
if (
  !code ||
  path.basename(code) !== code ||
  !["prepare", "repaint", "publish"].includes(mode)
)
  throw Error("One model code and prepare/repaint/publish required");
const spec = specs[code];
if (!spec) throw Error("Measured model recipe missing");
const renderSize = spec.renderBakeSize * 0.75,
  lodSize = spec.lodBakeSize * 0.75;
const smaller = `albedo-${renderSize}-${lodSize}-roughness4`;
const blender =
  process.env.BLENDER || "/Applications/Blender.app/Contents/MacOS/Blender";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const sharp = require("sharp");
let directory;
function run(command, args, label) {
  const file = path.join(base, "detailed", code, label + ".log");
  const fd = openSync(file, "w");
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: ["ignore", fd, fd],
    env: { ...process.env, GOCACHE: "/private/tmp/dndshare-go-cache" },
  });
  closeSync(fd);
  if (result.status !== 0) throw Error(label + " failed; inspect " + file);
}
function node(script, args, label) {
  run(process.execPath, ["scripts/maps/" + script, ...args], label);
}
function blend(script, args, label) {
  run(
    blender,
    [
      "--background",
      "--python-exit-code",
      "1",
      "--python",
      "scripts/maps/" + script,
      "--",
      ...args,
    ],
    label,
  );
}
async function snapshot(file) {
  const all = await mapTool("map_tile_models_list", {
    collection: "toxic-sewer",
  });
  const models = all.filter((m) => m.collection === "toxic-sewer");
  if (!models.length) throw Error("MCP collection snapshot is empty");
  await fs.writeFile(file, JSON.stringify(models, null, 2) + "\n", {
    mode: 0o600,
  });
  return models;
}
async function collage(report) {
  const views = ["preview", "reverse", "top", "lod-preview"];
  const candidates = ["accepted", "original", smaller];
  const maps = `maps-${spec.renderBakeSize / 2}-${spec.lodBakeSize / 2}-roughness4`;
  if (
    await fs
      .stat(path.join(directory, "candidates", maps, "report.json"))
      .catch(() => null)
  )
    candidates.push(maps);
  const layers = [];
  for (const [column, candidate] of candidates.entries())
    for (const [row, view] of views.entries())
      layers.push({
        input: await sharp(
          path.join(
            directory,
            candidate === "accepted" ? "" : "candidates",
            candidate,
            view + ".png",
          ),
        )
          .resize(384, 384)
          .png()
          .toBuffer(),
        left: column * 384,
        top: row * 384,
      });
  const file = path.join(directory, "comparison.jpg");
  await sharp({
    create: {
      width: candidates.length * 384,
      height: 1536,
      channels: 3,
      background: "#30342c",
    },
  })
    .composite(layers)
    .jpeg({ quality: 90 })
    .toFile(file);
  console.log(
    "REVIEW",
    file,
    "columns=accepted/full/smaller; rows=front/reverse/top/LOD",
  );
}
await fs.mkdir(path.join(base, "detailed", code), { recursive: true });
if (mode !== "publish") {
  const models = await snapshot(path.join(base, "registry-snapshot.json"));
  const current = models
    .filter((m) => m.sourceCode === code)
    .sort((a, b) => b.version - a.version)[0];
  if (!current || current.textureDetail === "detailed")
    throw Error("Model missing or already processed");
  directory = path.join(
    base,
    "detailed",
    code,
    `${code.replaceAll(" ", "_")}__v${current.version}`,
  );
  const report = path.join(directory, "report.json");
  let repaintReference;
  if (mode === "prepare") {
    node("prepare-toxic-sewer.mjs", [code], "prepare");
    const accepted = path.join(directory, "accepted");
    await fs.mkdir(accepted, { recursive: true });
    await fs.writeFile(
      path.join(accepted, "report.json"),
      JSON.stringify({ model: current }),
    );
    await fs.copyFile(
      path.join(directory, "render-input.glb"),
      path.join(accepted, "preview-model.glb"),
    );
    await fs.copyFile(
      path.join(directory, "lod-input.glb"),
      path.join(accepted, "lod-preview-model.glb"),
    );
    const acceptedArgs = [
      "--base",
      directory,
      "--size",
      "512",
      "--inside",
      "--review",
    ];
    blend("preview-model-revisions.py", acceptedArgs, "accepted-preview");
    blend(
      "preview-model-revisions.py",
      [...acceptedArgs, "--tier", "lod"],
      "accepted-lod",
    );
    blend("toxic_sewer_bake.py", ["--report", report], "bake");
  } else {
    const prepared = JSON.parse(await fs.readFile(report, "utf8"));
    if (prepared.publication || prepared.model.id !== current.id)
      throw Error("Prepared baseline changed or already published");
    repaintReference = path.join(directory, "repaint-reference");
    await fs.mkdir(repaintReference, { recursive: true });
    for (const tier of ["render", "lod"])
      await fs.copyFile(
        path.join(directory, tier + ".glb"),
        path.join(repaintReference, tier + ".glb"),
      );
  }
  const cachedReference = spec.referenceCode
    ? await fs
        .readFile(
          path.join(base, "references", spec.referenceCode + ".json"),
          "utf8",
        )
        .then(JSON.parse)
        .catch((error) => {
          if (error.code === "ENOENT") return null;
          throw error;
        })
    : null;
  if (
    spec.referenceCode &&
    (!cachedReference ||
      (cachedReference.minimumWallYMM ?? 8) !== (spec.referenceWallMinYMM ?? 8))
  )
    blend(
      "toxic_sewer_reference.py",
      [
        "--code",
        spec.referenceCode,
        ...(spec.referenceWallMinYMM !== undefined
          ? ["--minimum-wall-y", String(spec.referenceWallMinYMM)]
          : []),
      ],
      "reference",
    );
  node("paint-toxic-sewer.mjs", [report], "paint");
  node("prepare-reviewed-shadow.mjs", [report], "shadow");
  node(
    "validate-toxic-sewer.mjs",
    [report, ...(repaintReference ? ["--reference=" + repaintReference] : [])],
    "validate",
  );
  const previewArgs = [
    "--base",
    path.dirname(directory),
    "--size",
    "512",
    "--inside",
    "--review",
  ];
  blend("preview-model-revisions.py", previewArgs, "preview");
  blend(
    "preview-model-revisions.py",
    [...previewArgs, "--tier", "lod"],
    "lod-preview",
  );
  node(
    "prepare-albedo-candidate.mjs",
    [
      report,
      "--render-size=" + renderSize,
      "--lod-size=" + lodSize,
      "--roughness-step=4",
    ],
    "candidate",
  );
  if (spec.renderBakeSize > 1024)
    node("prepare-sewer-map-candidate.mjs", [report], "map-candidate");
  const candidates = [
    "--base",
    path.join(directory, "candidates"),
    "--size",
    "512",
    "--inside",
    "--review",
  ];
  blend("preview-model-revisions.py", candidates, "candidate-preview");
  blend(
    "preview-model-revisions.py",
    [...candidates, "--tier", "lod"],
    "candidate-lod",
  );
  blend("toxic_sewer_shadows.py", ["--report", report], "shadows");
  await collage(report);
  console.log("READY", code, report);
} else {
  const note = process.argv
    .find((a) => a.startsWith("--review-note="))
    ?.slice(14);
  const candidate = process.argv
    .find((a) => a.startsWith("--candidate="))
    ?.slice(12);
  if (!note || !candidate)
    throw Error("Publish requires the reviewed candidate and review note");
  const packetBase = path.join(base, "detailed", code);
  const directories = (await fs.readdir(packetBase)).filter((n) =>
    n.startsWith(code.replaceAll(" ", "_") + "__v"),
  );
  directories.sort(
    (a, b) => Number(b.split("__v")[1]) - Number(a.split("__v")[1]),
  );
  directory = path.join(packetBase, directories[0]);
  const report = path.join(directory, "report.json");
  const prepared = JSON.parse(await fs.readFile(report, "utf8"));
  if (prepared.publication || !prepared.shadowReview)
    throw Error("Already published or shadow review missing");
  const current = await snapshot(path.join(base, "registry-snapshot.json"));
  const latest = current
    .filter(
      (m) =>
        m.sourceCode === code && m.sourceName === prepared.model.sourceName,
    )
    .sort((a, b) => b.version - a.version)[0];
  if (latest.id !== prepared.model.id)
    throw Error("Accepted model changed during preparation");
  node("select-albedo-candidate.mjs", [report, candidate, note], "select");
  node("validate-toxic-sewer.mjs", [report], "final-validate");
  const previewCheck = await transparentPreview(
    path.join(directory, "preview.png"),
  );
  node("record-model-metrics.mjs", [report], "metrics");
  node(
    "package-masonry.mjs",
    [
      "--collection=toxic-sewer",
      "--base=" + packetBase,
      "--recipe=toxic-sewer-individual-v1",
    ],
    "package",
  );
  const packet = path.join(packetBase, "upload");
  const checkedReport = JSON.parse(await fs.readFile(report, "utf8"));
  checkedReport.shadowReview = prepared.shadowReview;
  checkedReport.visualReview = note;
  await fs.writeFile(report, JSON.stringify(checkedReport, null, 2) + "\n");
  if (
    !(await fs.readFile(path.join(directory, "preview.webp"))).equals(
      previewCheck.bytes,
    )
  )
    throw Error("Packaged WebP changed the verified alpha preview");
  const testEnv = {
    ...process.env,
    GOCACHE: "/private/tmp/dndshare-go-cache",
    MAP_MODEL_MANIFEST: path.join(packet, "catalogue.json"),
    MAP_MODEL_PREVIOUS_MANIFEST: path.join(base, "registry-snapshot.json"),
  };
  const validation = spawnSync(
    "go",
    [
      "test",
      "./internal/web",
      "-run",
      "TestPreparedCollectionManifest",
      "-count=1",
    ],
    { cwd: root, env: testEnv, encoding: "utf8" },
  );
  if (validation.status !== 0)
    throw Error(
      "Manifest validation failed: " + validation.stdout + validation.stderr,
    );
  run(
    "go",
    ["run", "./cmd/map-model-upload", "-assets", packet, "-workers", "1"],
    "upload",
  );
  const fresh = path.join(base, "registry-after.json");
  await snapshot(fresh);
  node(
    "confirm-reviewed-model.mjs",
    [code, fresh, "--collection=toxic-sewer"],
    "confirm",
  );
  node(
    "record-reviewed-model.mjs",
    [packet, "--collection=toxic-sewer"],
    "record",
  );
  const data = JSON.parse(await fs.readFile(report, "utf8"));
  const model = JSON.parse(
    await fs.readFile(path.join(packet, "catalogue.json"), "utf8"),
  )[0];
  data.visualReview = note;
  data.shadowReview = prepared.shadowReview;
  data.previewChecks = {
    width: previewCheck.width,
    height: previewCheck.height,
    bounds: previewCheck.bounds,
    transparentPixels: previewCheck.transparentPixels,
    opaquePixels: previewCheck.opaquePixels,
    alphaPreserved: true,
  };
  data.publication = {
    id: model.id,
    definitionId: model.definitionId,
    version: model.version,
    confirmedAt: new Date().toISOString(),
    registry: fresh,
  };
  await fs.writeFile(report, JSON.stringify(data, null, 2) + "\n");
  console.log("CONFIRMED", code, model.version, model.id);
}
