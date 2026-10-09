import fs from "node:fs";
import index from "./lost-cave-recipes.json" with { type: "json" };
function readRecipe(file) {
  const url = new URL(file, import.meta.url);
  const spec = JSON.parse(fs.readFileSync(url, "utf8"));
  for (const view of spec.treasure?.projectedViews || []) {
    if (view.regionsFile)
      view.regions = JSON.parse(
        fs.readFileSync(new URL(view.regionsFile, url), "utf8"),
      );
  }
  return spec;
}
export default Object.fromEntries(
  Object.entries(index).map(([code, file]) => [code, readRecipe(file)]),
);
