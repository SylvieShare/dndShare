// Sequential, resumable migration of already published individually painted models.
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import { STANDARD_MOUNT } from "./standard_mount.mjs";
const run = promisify(execFile),
  root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections/medieval-town-vol1"),
  blender =
    process.env.BLENDER ?? "/Applications/Blender.app/Contents/MacOS/Blender";
assert.ok(
  process.env.MCP_AUTH_TOKEN &&
    process.env.DNDSHARE_MAP_UPLOADER &&
    process.env.DNDSHARE_MAP_REVIEW_ROOT,
  "Use with-mcp.py and checked uploader/review checkout",
);
const original = JSON.parse(
  await fs.readFile(path.join(base, "registry-snapshot.json"), "utf8"),
)
  .filter((m) => m.collection === "medieval-town-vol1")
  .sort((a, b) => a.sourceCode.localeCompare(b.sourceCode));
for (const model of original) {
  const code = model.sourceCode,
    registry = JSON.parse(
      await fs.readFile(path.join(base, "registry-snapshot.json"), "utf8"),
    ),
    current = registry.find((m) => m.id === model.id),
    dir = path.join(base, "mount-standard", code);
  if (current.mountDepth === STANDARD_MOUNT.depth) {
    const r = JSON.parse(
      await fs.readFile(path.join(base, "review", code, "report.json"), "utf8"),
    );
    if (r.mountStandardCorrection?.profile === STANDARD_MOUNT.name) {
      assert.ok(r.publication?.assetsVerified);
      assert.deepEqual(r.model, current);
      continue;
    }
  }
  console.log("STANDARD_MIGRATION_START", code, new Date().toISOString());
  const resume = await fs.stat(path.join(dir, "upload", "catalogue.json")).then(
    () => true,
    () => false,
  );
  for (const [stage, cmd, args] of [
    [
      "prepare",
      "node",
      ["scripts/maps/prepare-medieval-standard-mount.mjs", code],
    ],
    [
      "preview",
      blender,
      [
        "--background",
        "--factory-startup",
        "--python-exit-code",
        "1",
        "--python",
        "scripts/maps/preview-model-revisions.py",
        "--",
        "--base",
        path.join(base, "mount-standard"),
        "--report",
        path.join(dir, "report.json"),
        "--codes",
        code,
        "--size",
        "512",
        "--review",
        "--transparent",
        ...(JSON.parse(
          await fs.readFile(
            path.join(base, "review", code, "report.json"),
            "utf8",
          ),
        ).optimization?.previewFacing === "front"
          ? ["--front"]
          : []),
      ],
    ],
    [
      "package",
      "node",
      ["scripts/maps/prepare-medieval-standard-mount.mjs", code, "--package"],
    ],
    [
      "publish",
      "node",
      ["scripts/maps/publish-medieval-standard-mount.mjs", code],
    ],
  ]) {
    if (resume && stage !== "publish") continue;
    const log = path.join(base, code + "-standard-" + stage + ".log");
    try {
      const result = await run(cmd, args, {
        cwd: root,
        maxBuffer: 4 * 1048576,
      });
      await fs.writeFile(log, result.stdout + (result.stderr ?? ""));
    } catch (error) {
      await fs.writeFile(
        log,
        (error.stdout ?? "") + (error.stderr ?? "") + "\n" + error.message,
      );
      throw Error(code + " " + stage + " failed; inspect " + log);
    }
  }
  const progress = JSON.parse(
    await fs.readFile(path.join(base, "mount-standard-progress.json"), "utf8"),
  );
  console.log(
    "STANDARD_MIGRATION_CONFIRMED",
    code,
    progress.filter((p) => p.status === "verified").length,
    "/",
    progress.length,
    new Date().toISOString(),
  );
}
console.log("STANDARD_MIGRATION_COMPLETE", original.length);
