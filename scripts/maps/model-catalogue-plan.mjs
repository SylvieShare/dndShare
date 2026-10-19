import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { names } from "./catalogue-labels.mjs";
import { highlandNames } from "./catalogue-highland-labels.mjs";
import { groupLabels } from "./catalogue-group-labels.mjs";

export function catalogueCategory(model) {
  if (model.tileType === "object") return "object";
  if (
    ["bridge", "stairs", "frame", "passage", "column"].includes(model.tileType)
  )
    return model.tileType;
  // Named water/river terrain is water even where it retains structural wall geometry.
  // Bridges, wells, fountains and baths remain their own kind.
  if (
    model.collection === "lost-cave" &&
    model.sourceName.startsWith("Railway")
  )
    return "railway";
  if (
    /^(?:(?:Low|Medium|High) )?(?:Water(?:\b|fall)|River\b)/.test(
      model.sourceName,
    ) ||
    model.sourceName.startsWith("Pipe Water")
  )
    return "water";
  if (model.tileType.startsWith("wall-")) return "wall";
  return model.tileType;
}
export function cataloguePlan(models) {
  const groups = new Map();
  const changes = models.map((m) => {
    const originalName = /[А-Яа-яЁё]/.test(m.name) ? m.sourceName : m.name;
    const nameEn =
      originalName === "MA_DungeonChest_Full_Prop" ? "Chest" : originalName.replace(/\bBorken\b/g, "Broken");
    const name =
      (m.collection === "majestic-highlands"
        ? highlandNames[originalName]
        : null) || names[originalName];
    if (!name)
      throw new Error(`Untranslated model ${m.definitionId}: ${nameEn}`);
    const labels = groupLabels[m.code];
    if (!labels) throw new Error(`Untranslated group ${m.code}`);
    const key = `${m.collection}:${m.code}`;
    const group = {
      collection: m.collection,
      code: m.code,
      ...labels,
      expectedName: m.groupName || "",
      expectedNameEn: m.groupNameEn || "",
    };
    if (
      groups.has(key) &&
      JSON.stringify(groups.get(key)) !== JSON.stringify(group)
    )
      throw new Error(`Inconsistent labels ${key}`);
    groups.set(key, group);
    return {
      definitionId: m.definitionId,
      expected: {
        name: m.name,
        nameEn: m.nameEn || "",
        category: m.category || "",
        code: m.code,
      },
      name,
      nameEn,
      category: catalogueCategory(m),
      code: m.code,
    };
  });
  return { models: changes, groups: [...groups.values()] };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const plan = cataloguePlan(
    JSON.parse(await fs.readFile(process.argv[2], "utf8")),
  );
  process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
}
