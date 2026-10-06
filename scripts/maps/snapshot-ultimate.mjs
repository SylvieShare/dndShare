import fs from "node:fs/promises";
import path from "node:path";
const file = process.argv[2];
if (!file) throw new Error("Fresh MCP snapshot file required");
const rows = JSON.parse(await fs.readFile(file, "utf8")).filter(
  (m) => m.collection === "ultimate-dungeon",
);
if (!rows.length || rows.some((m) => !m.assets.shadow))
  throw new Error(
    "Current Ultimate Dungeon snapshot with five resources required",
  );
const destination = path.resolve(
  import.meta.dirname,
  "../../models/collections/ultimate-dungeon/registry-snapshot.json",
);
await fs.writeFile(
  destination + ".next",
  JSON.stringify(rows, null, 2) + "\n",
  { mode: 0o600 },
);
await fs.rename(destination + ".next", destination);
console.log("ULTIMATE_SNAPSHOT", rows.length);
