// Build an ignored, content-addressed upload folder; publication uses the MCP CLI.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createRequire } from "node:module";
import { texturePolicy } from "./texture_policy.mjs";
import { lodTriangleLimit } from "./lod_budget.mjs";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(
  path.join(root, "models/.map-model-tools-runtime/package.json"),
);
const sharp = require("sharp");
const folder = path.resolve(process.argv[2]);
const recipe = JSON.parse(
  await fs.readFile(
    process.argv[3] || path.join(import.meta.dirname, "kobold-1635.json"),
    "utf8",
  ),
);
execFileSync(
  process.env.MODEL_PYTHON || "python3",
  [
    path.join(import.meta.dirname, "check-miniature-review.py"),
    folder,
    process.argv[3] || path.join(import.meta.dirname, "kobold-1635.json"),
  ],
  { stdio: "pipe" },
);
if (!(recipe.referenceDiameter > 0 && recipe.referenceDiameter <= 32))
  throw new Error("Recipe requires a reviewed referenceDiameter");
const output = path.join(folder, "publish");
const verification = JSON.parse(
  await fs.readFile(path.join(folder, "verification.json"), "utf8"),
);
if (verification.lodTriangleLimit !== lodTriangleLimit(recipe) ||
    !isDeepStrictEqual(verification.lodBudget, recipe.lodBudget ?? null))
  throw new Error("Verify the current authored LOD budget before packaging");
if (
  !verification.textureBudget?.passed ||
  !isDeepStrictEqual(verification.textureBudget.policy, texturePolicy(recipe))
)
  throw new Error("Verify the current decoded texture budget before packaging");
const silhouetteBytes = await fs.readFile(
  path.join(folder, "lod-silhouette.json"),
);
const silhouettePolicy = {
  ...JSON.parse(
    await fs.readFile(
      path.join(import.meta.dirname, "lod-silhouette-policy.json"),
    ),
  ),
  ...recipe.lodSilhouette,
};
if (
  !verification.silhouette?.passed ||
  !isDeepStrictEqual(JSON.parse(silhouetteBytes).policy, silhouettePolicy) ||
  crypto.createHash("sha256").update(silhouetteBytes).digest("hex") !==
    verification.silhouetteReportSHA256
)
  throw new Error("Verify the current LOD silhouette report before packaging");
if (
  !verification.passed ||
  verification.referenceDiameter !== recipe.referenceDiameter
)
  throw new Error(
    "Verify final files with the reviewed recipe before packaging",
  );
await fs.mkdir(output, { recursive: true });
const assets = {};
const files =
  recipe.assetFiles ||
  Object.fromEntries([
    ["render", "kobold-1635.glb"],
    ["lod", "kobold-1635-lod.glb"],
    ["shadow", "kobold-1635-shadow.glb"],
    ["source", "kobold-1635-master.glb"],
    ["preview", "preview.png"],
  ]);
for (const [kind, file] of Object.entries(files)) {
  const data =
    kind === "preview"
      ? await sharp(path.join(folder, file))
          .resize(512, 512, { fit: "inside" })
          .webp({ quality: 90 })
          .toBuffer()
      : await fs.readFile(path.join(folder, file));
  const sha256 = crypto.createHash("sha256").update(data).digest("hex");
  if (kind !== "preview" && verification.assetHashes[kind] !== sha256)
    throw new Error(`${kind} changed after verification`);
  const ext = kind === "preview" ? "webp" : "glb";
  const name = `${sha256}.${ext}`;
  await fs.writeFile(path.join(output, name), data);
  assets[kind] = {
    key: `map-models/${name}`,
    sha256,
    size: data.length,
    mimeType: kind === "preview" ? "image/webp" : "model/gltf-binary",
    fileName: recipe.assetFiles
      ? `${recipe.sourceCode.toLowerCase()}-${kind}.${ext}`
      : kind === "preview"
        ? "kobold-1635.webp"
        : file,
  };
}
const {
  itemId,
  itemIds,
  modelId,
  assetFiles,
  slug,
  materialProfile,
  calibration,
  build,
  lodSilhouette,
  lodBudget,
  texturePolicy: textureBudgetPolicy,
  reviewBase,
  artProfile,
  supportKind,
  ...metadata
} = recipe;
const model = {
  ...metadata,
  id: modelId,
  variantCode: "",
  category: "object",
  tileType: "object",
  textureDetail: "detailed",
  hasDecor: true,
  canStand: false,
  hidden: true,
  placementPoints: [],
  wallMode: "none",
  wallMask: 0,
  width: 1,
  height: 1,
  maxHeight: Math.ceil(verification.maxHeight * 10000) / 10000,
  placementOffset: [0, 0],
  mountDepth: 0,
  surfaceHeight: 0,
  blockers: [],
  tags: ["creature", "bestiary"],
  supportSlots: [],
  assets,
};
await fs.writeFile(
  path.join(output, "catalogue.json"),
  JSON.stringify([model], null, 2) + "\n",
);
console.log(
  JSON.stringify({
    output,
    itemId,
    modelId,
    bytes: Object.fromEntries(
      Object.entries(assets).map(([k, a]) => [k, a.size]),
    ),
  }),
);
