// Apply the individually reviewed family to an already published Majestic variant.
import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { mapTool } from "./mcp_maps_client.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const code = process.argv.find((arg) => arg.startsWith("--code="))?.slice(7);
if (!code) throw new Error("Reviewed model code required");
const index = JSON.parse(await fs.readFile(path.join(root, "scripts/maps/majestic-recipes.json"), "utf8"));
const recipe = JSON.parse(await fs.readFile(path.join(root, "scripts/maps", index[code]), "utf8"));
if (!/^MH-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.groupCode ?? ""))
  throw new Error("Individually reviewed Majestic groupCode required");
const source = JSON.parse(await fs.readFile(path.join(root, "models/collections/majestic-highlands/manifest.json"), "utf8"))
  .find((model) => model.code === code);
const find = (models) => models.find((model) => model.collection === "majestic-highlands" && model.sourceCode === code && model.sourceName === source.sourceName);
const previous = find(await mapTool("map_tile_models_list"));
if (!previous) throw new Error("Publish the reviewed model before assigning its family");
await mapTool("map_tile_model_group_update", {
  definitionId: previous.definitionId,
  expectedCode: previous.code,
  code: recipe.groupCode,
});
const current = find(await mapTool("map_tile_models_list"));
if (!current || current.code !== recipe.groupCode)
  throw new Error("Family update not confirmed by fresh MCP read");
const withoutCode = ({ code: _code, ...model }) => model;
if (!isDeepStrictEqual(withoutCode(current), withoutCode(previous)))
  throw new Error("Model resources or placement changed during the family update; review fresh registry");
console.log("MAJESTIC_GROUP_CONFIRMED", code, current.definitionId, current.code);
