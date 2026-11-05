import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const root = path.resolve(import.meta.dirname, "../..");
const base = path.join(root, "models/collections/toxic-sewer");
const registry = JSON.parse(
  await fs.readFile(path.join(base, "registry-snapshot.json"), "utf8"),
);
const reports = [];
const unique = new Map();
for (const entry of await fs.readdir(path.join(base, "detailed"), {
  withFileTypes: true,
})) {
  if (!entry.isDirectory()) continue;
  for (const preparedFolder of await fs.readdir(
    path.join(base, "detailed", entry.name),
    { withFileTypes: true },
  )) {
    if (!preparedFolder.isDirectory() || preparedFolder.name === "upload")
      continue;
    const file = path.join(
      base,
      "detailed",
      entry.name,
      preparedFolder.name,
      "report.json",
    );
    const raw = await fs.readFile(file, "utf8").catch((e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (!raw) continue;
    const report = JSON.parse(raw);
    if (!report.publication || report.publication.supersededAt) continue;
    const model = registry.find((m) => m.id === report.publication.id);
    assert.ok(model, "Publication must be confirmed in the MCP snapshot");
    assert.equal(
      model.assets.source.sha256,
      report.resourceMetrics.source.sha256,
    );
    for (const role of ["render", "lod", "shadow", "preview"]) {
      assert.equal(model.assets[role].size, report.resourceMetrics[role].bytes);
      const assetFile =
        role === "shadow"
          ? report.preparedShadow.asset.sha256 + ".glb"
          : role + (role === "preview" ? ".webp" : ".glb");
      const bytes = await fs.readFile(path.join(path.dirname(file), assetFile));
      assert.equal(bytes.length, model.assets[role].size);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        model.assets[role].sha256,
        "Current resource differs from the reviewed local result",
      );
      unique.set(model.assets[role].sha256, model.assets[role].size);
    }
    reports.push({ model, report, file: path.relative(root, file) });
  }
}
reports.sort((a, b) => a.model.sourceCode.localeCompare(b.model.sourceCode));
const rows = reports
  .map(
    ({ model: m }) =>
      `| ${m.sourceCode} ${m.sourceName} | \`${m.id}\` | ${m.assets.render.sha256.slice(0, 12)} | ${m.assets.render.size.toLocaleString("ru-RU")} Б | ${m.assets.lod.size.toLocaleString("ru-RU")} Б | ${m.assets.shadow.size.toLocaleString("ru-RU")} Б | ${m.assets.preview.size.toLocaleString("ru-RU")} Б |`,
  )
  .join("\n");
const file = path.join(root, "md/features/toxic-sewer.md");
let text = await fs.readFile(file, "utf8");
const publicationDates = [
  ...new Set(
    reports.map(({ report }) =>
      new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Moscow",
      }).format(new Date(report.publication.confirmedAt)),
    ),
  ),
];
if (publicationDates.length)
  text = text.replace(
    /^## Подтверждённые публикации.*$/m,
    "## Подтверждённые публикации — " + publicationDates.join("; "),
  );
const oldStart = text.indexOf("| Модель | UUID версии |");
const start =
  oldStart >= 0 ? oldStart : text.indexOf("| Модель | UUID модели |");
const end = text.indexOf("\n\nTS-001:", start);
if (start < 0 || end < 0)
  throw Error("Publication journal table markers missing");
text =
  text.slice(0, start) +
  "| Модель | UUID модели | Render SHA-256 | Render | LOD | Shadow | Preview |\n| --- | --- | --- | --- | --- | --- | --- |\n" +
  rows +
  text.slice(end);
await fs.writeFile(file, text);
const total = [...unique.values()].reduce((sum, n) => sum + n, 0);
await fs.writeFile(
  path.join(base, "publication-summary.json"),
  JSON.stringify(
    {
      published: reports.length,
      runtimeUniqueBytes: total,
      models: reports.map(({ model, report, file }) => ({
        code: model.sourceCode,
        id: model.id,

        assets: model.assets,
        triangles: Object.fromEntries(
          ["render", "lod", "shadow"].map((k) => [
            k,
            report.resourceMetrics[k].triangles,
          ]),
        ),
        report: file,
      })),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "TOXIC_SEWER_JOURNAL",
  reports.length,
  "published;",
  total,
  "unique runtime bytes",
);
