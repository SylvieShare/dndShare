import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  STANDARD_MOUNT,
  fitStandardMount,
  verifyStandardMountBody,
  validateStandardMount,
} from "./standard_mount.mjs";
import { writeBlenderPreview } from "./review_glb_preview.mjs";
import { prepareShadow } from "./shadow_model.mjs";
import { localModelAsset } from "./local_model_assets.mjs";
const root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections/medieval-town-vol1"),
  req = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = req("sharp");
const hash = (b) => createHash("sha256").update(b).digest("hex");
export const correctionReason =
  "User-requested UD-016 insertion standard: replace legacy 10/17 mm pegs by 5.373095 mm, 35/25.96 mm frusta while retaining original body buffers, textures, UUID, source and body world position.";
async function currentFile(model, tier) {
  const first = path.join(base, "review", model.sourceCode, tier + ".glb");
  try {
    const b = await fs.readFile(first);
    if (hash(b) === model.assets[tier].sha256) return first;
  } catch {}
  return localModelAsset(model.assets[tier]);
}
export async function prepareMedievalStandardMount(code) {
  const registry = JSON.parse(
      await fs.readFile(path.join(base, "registry-snapshot.json"), "utf8"),
    ),
    model = registry.find(
      (m) => m.sourceCode === code && m.collection === "medieval-town-vol1",
    );
  assert.ok(
    model && model.textureDetail === "detailed",
    "Current individually painted model required",
  );
  assert.notEqual(
    model.mountDepth,
    STANDARD_MOUNT.depth,
    "Model is already standardized",
  );
  const frameFit = JSON.parse(
      await fs.readFile(
        path.join(base, "mount-standard-native-frame-fit.json"),
        "utf8",
      ),
    ),
    inventory = JSON.parse(
      await fs.readFile(path.join(base, "inventory.json"), "utf8"),
    ),
    frames = inventory.filter((r) => Number(r.code.slice(4)) >= 700);
  assert.equal(frameFit.length, frames.length);
  for (const f of frameFit) {
    assert.equal(
      f.sourceSHA256,
      frames.find((r) => r.code === f.code)?.sourceSHA256,
    );
    assert.ok(
      f.slots.every(
        (s) => s.independentTriangleClippingPassed && s.insertionRiseMM <= 5.25,
      ),
    );
  }
  const dir = path.join(base, "mount-standard", code);
  await fs.mkdir(dir, { recursive: true });
  const paint = JSON.parse(
    await fs.readFile(path.join(base, "review", code, "report.json"), "utf8"),
  );
  assert.deepEqual(
    paint.model,
    model,
    "Painting report differs from fresh registry",
  );
  const report = {
    model: structuredClone(model),
    originalModel: structuredClone(model),
    recipe: "medieval-ud016-mount-v1",
    geometryCorrection: { reason: correctionReason },
    mountStandard: {
      ...STANDARD_MOUNT,
      bodyAndAtlases: "original compressed byte buffers retained",
    },
    nativeFrameFit: {
      frames: frameFit.length,
      slots: frameFit.reduce((n, f) => n + f.slots.length, 0),
      maxInsertionRiseMM: Math.max(
        ...frameFit.flatMap((f) => f.slots.map((s) => s.insertionRiseMM)),
      ),
    },
    tiers: {},
    publication: null,
  };
  await fs.writeFile(
    path.join(dir, "source-paint-report.json"),
    JSON.stringify(paint, null, 2) + "\n",
  );
  await fs.writeFile(
    path.join(dir, "previous-catalogue.json"),
    JSON.stringify([model], null, 2) + "\n",
  );
  for (const tier of ["render", "lod"]) {
    const before = await fs.readFile(await currentFile(model, tier));
    assert.equal(before.length, model.assets[tier].size);
    assert.equal(hash(before), model.assets[tier].sha256);
    const result = await fitStandardMount(before, model);
    assert.equal(result.unchanged, false);
    const proof = await verifyStandardMountBody(
      before,
      result.bytes,
      model,
      result.model,
    );
    await validateStandardMount(result.bytes, result.model);
    await fs.writeFile(path.join(dir, "input-" + tier + ".glb"), before);
    await fs.writeFile(path.join(dir, tier + ".glb"), result.bytes);
    await writeBlenderPreview(
      result.bytes,
      path.join(
        dir,
        tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
      ),
    );
    report.model = result.model;
    report.tiers[tier] = {
      ...proof,
      beforeSHA256: hash(before),
      sha256: hash(result.bytes),
      beforeBytes: before.length,
      bytes: result.bytes.length,
      pads: result.pads.length,
      padBounds: result.pads,
    };
  }
  const shadow = await prepareShadow(
    path.join(dir, "lod.glb"),
    path.join(dir, "shadow.glb"),
  );
  report.preparedShadow = shadow;
  report.tiers.shadow = {
    bytes: shadow.asset.size,
    triangles: shadow.triangles,
    bounds: shadow.bounds,
  };
  await fs.writeFile(
    path.join(dir, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "MEDIEVAL_STANDARD_PREPARED",
    code,
    report.model.id,
    report.tiers.render.pads,
  );
  return report;
}
export async function packageMedievalStandardMount(code) {
  const dir = path.join(base, "mount-standard", code),
    file = path.join(dir, "report.json"),
    r = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(r.recipe, "medieval-ud016-mount-v1");
  assert.deepEqual(
    standardWithoutAssets(r.model),
    standardWithoutAssets(
      (
        await fitStandardMount(
          await fs.readFile(path.join(dir, "input-render.glb")),
          r.originalModel,
        )
      ).model,
    ),
  );
  const preview = await fs.readFile(path.join(dir, "transparent-preview.png"));
  const { data, info } = await sharp(preview)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let opaque = 0,
    transparent = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a === 0) transparent++;
      else opaque++;
      if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1)
        assert.equal(a, 0, "Preview touches edge");
    }
  assert.ok(opaque && transparent);
  await sharp(preview)
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(path.join(dir, "preview.webp"));
  const upload = path.join(dir, "upload");
  await fs.mkdir(upload, { recursive: true });
  const assets = { source: structuredClone(r.originalModel.assets.source) };
  for (const tier of ["render", "lod"]) {
    const bytes = await fs.readFile(path.join(dir, tier + ".glb"));
    const before = await fs.readFile(path.join(dir, "input-" + tier + ".glb"));
    assert.equal(hash(before), r.originalModel.assets[tier].sha256);
    await verifyStandardMountBody(before, bytes, r.originalModel, r.model);
    await validateStandardMount(bytes, r.model);
  }
  for (const kind of ["render", "lod", "shadow", "preview"]) {
    const ext = kind === "preview" ? "webp" : "glb",
      bytes = await fs.readFile(path.join(dir, kind + "." + ext)),
      sha = hash(bytes);
    assert.ok(bytes.length <= (kind === "preview" ? 4 : 32) * 1048576);
    await fs.writeFile(path.join(upload, sha + "." + ext), bytes);
    assets[kind] = {
      key: "map-models/" + sha + "." + ext,
      sha256: sha,
      size: bytes.length,
      mimeType: ext === "webp" ? "image/webp" : "model/gltf-binary",
      fileName: kind + "." + ext,
    };
  }
  const row = JSON.parse(
      await fs.readFile(path.join(base, "inventory.json"), "utf8"),
    ).find((r) => r.code === code),
    source = path.join(root, "models", row.sourcePath);
  assert.equal(row.sourceSHA256, assets.source.sha256);
  const bytes = await fs.readFile(source);
  assert.equal(hash(bytes), assets.source.sha256);
  assert.equal(bytes.length, assets.source.size);
  const target = path.join(upload, path.basename(assets.source.key));
  await fs.symlink(source, target).catch((e) => {
    if (e.code !== "EEXIST") throw e;
  });
  r.model.assets = assets;
  await fs.writeFile(
    path.join(upload, "catalogue.json"),
    JSON.stringify([r.model], null, 2) + "\n",
  );
  await fs.writeFile(file, JSON.stringify(r, null, 2) + "\n");
  console.log(
    "MEDIEVAL_STANDARD_MANIFEST",
    code,
    r.model.id,
    Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, v.size])),
  );
  return r;
}
function standardWithoutAssets(m) {
  const { assets, ...rest } = m;
  return rest;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = process.argv[2];
  assert.match(code ?? "", /^MT1-\d{3}$/);
  if (process.argv.includes("--package"))
    await packageMedievalStandardMount(code);
  else await prepareMedievalStandardMount(code);
}
