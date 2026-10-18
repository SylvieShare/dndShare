import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { addLightEffectPreview } from "./light_effect_preview.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { dequantize } = require("@gltf-transform/functions"),
  { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder }),
  code = process.argv[2];
if (!/^MT1-\d{3}$/.test(code || "")) throw Error("One code required");
const directory = path.resolve(
    import.meta.dirname,
    "../../models/collections/medieval-town-vol1/light-effects",
    code,
  ),
  report = JSON.parse(
    await fs.readFile(path.join(directory, "report.json"), "utf8"),
  ),
  recipe = JSON.parse(
    await fs.readFile(
      path.join(import.meta.dirname, "medieval-recipes", code + ".json"),
      "utf8",
    ),
  );
await fs.mkdir(path.join(directory, "off"), { recursive: true });
for (const tier of ["render", "lod"]) {
  const bytes = await fs.readFile(path.join(directory, tier + ".glb"));
  for (const on of [false, true]) {
    const doc = await io.readBinary(bytes);
    await doc.transform(dequantize());
    for (const extension of doc.getRoot().listExtensionsUsed())
      if (extension.extensionName === "EXT_meshopt_compression")
        extension.dispose();
    if (on) addLightEffectPreview(doc, report.model, recipe.defaultLights);
    const folder = on ? directory : path.join(directory, "off");
    await io.write(
      path.join(
        folder,
        tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
      ),
      doc,
    );
  }
}
report.recipe = recipe;
await fs.writeFile(
  path.join(directory, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
await fs.writeFile(
  path.join(directory, "off/report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log("LIGHT_PREVIEW_COPIES", code);
