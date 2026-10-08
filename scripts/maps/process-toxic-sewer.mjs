// One model per invocation. Publication requires an explicit visual review note.
import fs from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mapTool } from "./mcp_maps_client.mjs";
import { transparentPreview } from "./preview_image.mjs";
import { assertModelBaseline } from "./toxic_sewer_baseline.mjs";
import specs from "./toxic_sewer_recipes.mjs";
const root = path.resolve(import.meta.dirname, "../..");
const backendRoot = path.resolve(process.env.MAP_MODEL_BACKEND_ROOT || root);
const base = path.join(root, "models/collections/toxic-sewer");
const code = process.argv[2],
  mode = process.argv[3];
const reviseUv = process.argv.includes("--revise-uv");
if (reviseUv && mode !== "prepare") throw Error("UV revision requires prepare");
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
    cwd: command === "go" ? backendRoot : root,
    stdio: ["ignore", fd, fd],
    env: { ...process.env, GOCACHE: "/private/tmp/dndshare-go-cache" },
  });
  closeSync(fd);
  if (result.status !== 0) throw Error(label + " failed; inspect " + file);
}
function node(script, args, label) {
  const shared = [
    "package-masonry.mjs",
    "confirm-reviewed-model.mjs",
    "record-reviewed-model.mjs",
  ].includes(script);
  const file = shared
    ? path.join(backendRoot, "scripts/maps", script)
    : "scripts/maps/" + script;
  run(process.execPath, [file, ...args], label);
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
  let all;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      all = await mapTool("map_tile_models_list", {
        collection: "toxic-sewer",
      });
      break;
    } catch (error) {
      if (attempt === 3 || !/HTTP (502|503|504)/.test(error.message))
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
    }
  }
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
  const current = models.filter((m) => m.sourceCode === code)[0];
  if (!current || (current.textureDetail === "detailed" && !reviseUv))
    throw Error("Model missing or already processed");
  directory = path.join(
    base,
    "detailed",
    code,
    `${code.replaceAll(" ", "_")}__v${current.assets.render.sha256.slice(0, 12)}`,
  );
  const report = path.join(directory, "report.json");
  let repaintReference;
  if (mode === "prepare") {
    let prior;
    if (reviseUv) {
      if (current.textureDetail !== "detailed")
        throw Error("UV revision requires a published detailed model");
      const summary = JSON.parse(
        await fs.readFile(path.join(base, "publication-summary.json"), "utf8"),
      );
      const entry = summary.models.find(
        (m) => m.code === code && m.id === current.id,
      );
      if (!entry) throw Error("Reviewed current publication missing");
      const file = path.join(root, entry.report);
      const data = JSON.parse(await fs.readFile(file, "utf8"));
      const bytes = await fs.readFile(
        path.join(path.dirname(file), "render.glb"),
      );
      if (
        createHash("sha256").update(bytes).digest("hex") !==
        current.assets.render.sha256
      )
        throw Error("Current assets differ from the local reviewed result");
      prior = { file, data };
    }
    node("prepare-toxic-sewer.mjs", [code], "prepare");
    if (prior) {
      const data = JSON.parse(await fs.readFile(report, "utf8"));
      data.reunwrapAcceptedGeometry = true;
      data.supersedesReport = prior.file;
      data.sourceShiftMM = prior.data.sourceShiftMM;
      await fs.writeFile(report, JSON.stringify(data, null, 2) + "\n");
    }
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
    if (prepared.publication) throw Error("Already published");
    assertModelBaseline(prepared.model, current);
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
      (cachedReference.minimumWallYMM ?? 8) !==
        (spec.referenceWallMinYMM ?? 8) ||
      (cachedReference.maximumFloorZMM ?? 15) !==
        (spec.referenceFloorMaxZMM ?? 15))
  )
    blend(
      "toxic_sewer_reference.py",
      [
        "--code",
        spec.referenceCode,
        ...(spec.referenceWallMinYMM !== undefined
          ? ["--minimum-wall-y", String(spec.referenceWallMinYMM)]
          : []),
        ...(spec.referenceFloorMaxZMM !== undefined
          ? ["--maximum-floor-z", String(spec.referenceFloorMaxZMM)]
          : []),
      ],
      "reference",
    );
  if (spec.proximityReference) {
    const proximity = spec.proximityReference;
    const cached = await fs
      .readFile(
        path.join(base, "references", proximity.code + "-proximity.json"),
        "utf8",
      )
      .then(JSON.parse)
      .catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
    if (
      !cached ||
      (proximity.minimumSurfaceZMM !== undefined && !cached.cutCapsExcluded) ||
      cached.stepMM !== proximity.stepMM ||
      (cached.rotationZDegrees ?? 0) !== (proximity.rotationZDegrees ?? 0) ||
      (cached.minimumSurfaceZMM ?? null) !==
        (proximity.minimumSurfaceZMM ?? null) ||
      JSON.stringify(cached.boundsMM) !== JSON.stringify(proximity.boundsMM)
    )
      blend(
        "toxic_sewer_proximity.py",
        ["--report", report, "--reference-spec", JSON.stringify(proximity)],
        "proximity",
      );
  }
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
  const modified = new Map(
    await Promise.all(
      directories.map(async (name) => [
        name,
        (await fs.stat(path.join(packetBase, name, "report.json"))).mtimeMs,
      ]),
    ),
  );
  directories.sort((a, b) => modified.get(b) - modified.get(a));
  directory = path.join(packetBase, directories[0]);
  const report = path.join(directory, "report.json");
  const prepared = JSON.parse(await fs.readFile(report, "utf8"));
  if (prepared.publication || !prepared.shadowReview)
    throw Error("Already published or shadow review missing");
  const current = await snapshot(path.join(base, "registry-snapshot.json"));
  const latest = current.filter(
    (m) => m.sourceCode === code && m.sourceName === prepared.model.sourceName,
  )[0];
  assertModelBaseline(prepared.model, latest);
  node("select-albedo-candidate.mjs", [report, candidate, note], "select");
  const selectedReview = JSON.parse(await fs.readFile(report, "utf8"));
  selectedReview.shadowReview = prepared.shadowReview;
  selectedReview.visualReview = note;
  await fs.writeFile(report, JSON.stringify(selectedReview, null, 2) + "\n");
  node("validate-toxic-sewer.mjs", [report], "final-validate");
  const previewCheck = await transparentPreview(
    path.join(directory, "preview.png"),
  );
  node("record-model-metrics.mjs", [report], "metrics");
  // Package only the selected baseline; reviewed prior reports remain local.
  const selection = await fs.mkdtemp(path.join(packetBase, "pack-selection-"));
  const picked = path.join(selection, "current");
  await fs.mkdir(picked);
  for (const name of [
    "report.json",
    "preview.png",
    "render.glb",
    "lod.glb",
    prepared.preparedShadow.asset.sha256 + ".glb",
  ])
    await fs.copyFile(path.join(directory, name), path.join(picked, name));
  node(
    "package-masonry.mjs",
    [
      "--collection=toxic-sewer",
      "--base=" + selection,
      "--recipe=toxic-sewer-individual-v1",
    ],
    "package",
  );
  const packet = path.join(packetBase, "upload");
  const stagedPacket = path.join(selection, "upload");
  await fs.mkdir(packet, { recursive: true });
  for (const name of await fs.readdir(stagedPacket)) {
    const from = path.join(stagedPacket, name),
      to = path.join(packet, name);
    if (name === "catalogue.json") await fs.copyFile(from, to);
    else
      await fs.link(from, to).catch((error) => {
        if (error.code !== "EEXIST") throw error;
      });
  }
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
    { cwd: backendRoot, env: testEnv, encoding: "utf8" },
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

    confirmedAt: new Date().toISOString(),
    registry: fresh,
  };
  await fs.writeFile(report, JSON.stringify(data, null, 2) + "\n");
  if (data.supersedesReport) {
    const prior = JSON.parse(await fs.readFile(data.supersedesReport, "utf8"));
    prior.publication.supersededAt = data.publication.confirmedAt;
    prior.publication.supersededBy = report;
    await fs.writeFile(
      data.supersedesReport,
      JSON.stringify(prior, null, 2) + "\n",
    );
  }
  console.log(
    "CONFIRMED",
    code,
    model.assets.render.sha256.slice(0, 12),
    model.id,
  );
}
