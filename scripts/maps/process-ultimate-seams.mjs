// Resumable, strictly sequential publication of the common mortar correction.
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections");
const registryFile = path.join(base, "registry.json"),
  progressFile = path.join(base, "floor-seams/progress.json");
const registry = JSON.parse(await fs.readFile(registryFile, "utf8"));
const progress = JSON.parse(
  await fs.readFile(progressFile, "utf8").catch(() => "{}"),
);
const selected = process.argv
  .find((a) => a.startsWith("--codes="))
  ?.slice(8)
  .split(",");
const noUpload = process.argv.includes("--no-upload");
const latest = new Map();
for (const m of registry.filter((m) => m.collection === "ultimate-dungeon")) {
  const key = m.sourceCode + ":" + m.sourceName;
  if (!latest.has(key) || latest.get(key).version < m.version)
    latest.set(key, m);
}
await fs.mkdir(path.dirname(progressFile), { recursive: true });
async function run(command, args, log) {
  const handle = await fs.open(log, "w");
  const code = await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, GOCACHE: "/private/tmp/dndshare-go-cache" },
      stdio: ["ignore", handle.fd, handle.fd],
    });
    child.once("error", reject);
    child.once("exit", resolve);
  });
  await handle.close();
  if (code !== 0)
    throw new Error(command + " failed: " + (await fs.readFile(log, "utf8")));
}
async function save() {
  await fs.writeFile(
    progressFile + ".next",
    JSON.stringify(progress, null, 2) + "\n",
  );
  await fs.rename(progressFile + ".next", progressFile);
}
let completed = 0;
for (const [key, m] of [...latest].sort(([a], [b]) => a.localeCompare(b))) {
  if (selected && !selected.includes(m.sourceCode)) continue;
  if (m.sourceCode === "UD-001") {
    progress[key] = { status: "benchmark", id: m.id };
    await save();
    continue;
  }
  if (progress[key]?.status === "published" && progress[key].id === m.id) {
    completed++;
    continue;
  }
  const folder =
    "floor-seams/" +
    m.sourceCode +
    (m.sourceCode === "UD-055" ? "_" + m.sourceName.replaceAll(" ", "_") : "");
  const absolute = path.join(base, folder),
    log = "/private/tmp/dndshare-floor-" + m.sourceCode + ".log";
  console.log("FLOOR_START", m.sourceCode, m.sourceName, flushTime());
  await run(
    process.execPath,
    ["scripts/maps/darken-ultimate-floor.mjs", m.sourceCode, m.sourceName],
    log,
  );
  const entry = (await fs.readdir(absolute)).find((name) => name !== "upload");
  const report = JSON.parse(
    await fs.readFile(path.join(absolute, entry, "report.json"), "utf8"),
  );
  if (
    !report.tiers.render.surfacePixels.joint &&
    !report.tiers.lod.surfacePixels.joint
  ) {
    progress[key] = { status: "no-stone-joints", sourceId: m.id };
    await save();
    console.log("FLOOR_NO_JOINTS", m.sourceCode);
    continue;
  }
  await run(
    "/Applications/Blender.app/Contents/MacOS/Blender",
    [
      "--background",
      "--python-exit-code",
      "1",
      "--python",
      "scripts/maps/preview-model-revisions.py",
      "--",
      "--base",
      absolute,
      "--size",
      "512",
      "--front",
    ],
    log + ".render",
  );
  await run(
    process.execPath,
    ["scripts/maps/validate-masonry.mjs", "--base=" + folder],
    log + ".validate",
  );
  await run(
    process.execPath,
    [
      "scripts/maps/package-masonry.mjs",
      "--base=" + absolute,
      "--recipe=ultimate-floor-mortar-v1",
    ],
    log + ".package",
  );
  const catalogue = path.join(absolute, "upload/catalogue.json");
  const prepared = JSON.parse(await fs.readFile(catalogue, "utf8"));
  if (noUpload) {
    console.log("FLOOR_REVIEW_READY", m.sourceCode, absolute);
    continue;
  }
  await run(
    "/private/tmp/dndshare-map-model-upload",
    ["-assets", path.dirname(catalogue), "-workers", "1"],
    log + ".upload",
  );
  for (const item of prepared)
    if (!registry.some((x) => x.id === item.id)) registry.push(item);
  await fs.writeFile(
    registryFile + ".next",
    JSON.stringify(registry, null, 2) + "\n",
    { mode: 0o600 },
  );
  await fs.rename(registryFile + ".next", registryFile);
  progress[key] = {
    status: "published",
    id: prepared[0].id,
    version: prepared[0].version,
    sourceId: m.id,
    pixels: report.tiers.render.surfacePixels.joint,
    textureDetail: m.textureDetail,
  };
  await save();
  completed++;
  console.log(
    "FLOOR_PUBLISHED",
    completed,
    m.sourceCode,
    prepared[0].version,
    flushTime(),
  );
}
function flushTime() {
  return new Date().toISOString();
}
console.log("FLOOR_FINISHED", completed);
