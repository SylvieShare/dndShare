import fs from "node:fs";
import index from "./toxic-sewer-recipes.json" with { type: "json" };
export default Object.fromEntries(
  Object.entries(index).map(([code, file]) => [
    code,
    JSON.parse(fs.readFileSync(new URL(file, import.meta.url), "utf8")),
  ]),
);
