// Apply the individually reviewed family to an already published Majestic variant.
import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { mapTool } from "./mcp_maps_client.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const code = process.argv.find((arg) => arg.startsWith("--code="))?.slice(7);
if (!code) throw new Error("Reviewed model code required");
const index = JSON.parse(
  await fs.readFile(
    path.join(root, "scripts/maps/majestic-recipes.json"),
    "utf8",
  ),
);
const recipe = JSON.parse(
  await fs.readFile(path.join(root, "scripts/maps", index[code]), "utf8"),
);
const source = JSON.parse(
  await fs.readFile(
    path.join(root, "models/collections/majestic-highlands/manifest.json"),
    "utf8",
  ),
).find((model) => model.code === code);
const find = (models) =>
  models.find(
    (model) =>
      model.collection === "majestic-highlands" &&
      model.sourceCode === code &&
      model.sourceName === source.sourceName,
  );
const previous = find(await mapTool("map_tile_models_list"));
if (!previous)
  throw new Error("Publish the reviewed model before assigning its family");
if (recipe.variantCode === undefined) {
  if (!Object.hasOwn(previous, "variantCode"))
    throw new Error(
      "Review section groupCode and variantCode before publishing a new family",
    );
  console.log(
    "MAJESTIC_GROUPING_PRESERVED",
    code,
    previous.code,
    previous.variantCode,
  );
  process.exit(0);
}
if (
  ![recipe.groupCode, recipe.variantCode].every((value) =>
    /^MH-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
  )
)
  throw new Error("Reviewed groupCode and variantCode required");
await mapTool("map_tile_model_grouping_update", {
  models: [
    {
      definitionId: previous.definitionId,
      expectedCode: previous.code,
      expectedVariantCode: previous.variantCode,
      code: recipe.groupCode,
      variantCode: recipe.variantCode,
    },
  ],
});
const current = find(await mapTool("map_tile_models_list"));
if (
  !current ||
  current.code !== recipe.groupCode ||
  current.variantCode !== recipe.variantCode
)
  throw new Error("Grouping update not confirmed");
const withoutGrouping = ({ code: _code, variantCode: _variant, ...model }) =>
  model;
if (!isDeepStrictEqual(withoutGrouping(current), withoutGrouping(previous)))
  throw new Error("Concurrent model edit; review fresh registry");
console.log(
  "MAJESTIC_GROUP_CONFIRMED",
  code,
  current.definitionId,
  current.code,
  current.variantCode,
);
