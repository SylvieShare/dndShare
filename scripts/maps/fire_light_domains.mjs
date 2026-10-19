// Reuse the exact native/cropped domains used to paint each accepted model.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { torchPartAt } from "./torch_material.mjs";
import { addedDistance } from "./added_bones.mjs";
import { structureDomain } from "./medieval_structure_domains.mjs";
import { initializeStructureReferences } from "./medieval_source_reference.mjs";
import { loadReviewedCaveViews } from "./reviewed_cave_views.mjs";
import { mineProjectionAt } from "./lost_cave_mine.mjs";
import { paintMineFlame } from "./lost_cave_torch.mjs";
const root = path.resolve(import.meta.dirname, "../..");
const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));

export async function fireLightDomain(code, report) {
  if (code.startsWith("UD-")) {
    const spec = (
      await read(path.join(import.meta.dirname, "ultimate-lighting.json"))
    )[code];
    assert.ok(spec?.lit && spec.proceduralFire, "Measured lit torch required");
    let reference;
    if (spec.bareReference) {
      const base = path.join(root, "models/collections/added-reference", code);
      reference = {
        spec: await read(path.join(base, "reference.json")),
        data: await fs.readFile(path.join(base, "distance.bin")),
      };
      assert.equal(reference.spec.bare, spec.bareReference);
    }
    return {
      matches: (p) =>
        torchPartAt(p, spec) === "flame" &&
        (!reference || addedDistance(p, reference) >= 0.35),
      shift: [0, 0, 0],
      recipe: spec,
      evidence: reference
        ? {
            reference: reference.spec,
            fieldSHA256: createHash("sha256")
              .update(reference.data)
              .digest("hex"),
          }
        : { measuredTorchVariant: spec.variant },
    };
  }
  if (code === "LC-079") {
    const spec = await read(
      path.join(import.meta.dirname, "lost-cave-recipes", code + ".json"),
    );
    const masks = spec.mine.projectedViews.flatMap((view) =>
      view.regions.map((region) => ({
        ...region,
        name: view.name,
        toleranceMM: view.toleranceMM,
        depthPixelRadius: view.depthPixelRadius ?? region.depthPixelRadius,
      })),
    );
    const iron = await loadReviewedCaveViews(
        report,
        masks.filter((m) => m.part === "iron"),
      ),
      rest = await loadReviewedCaveViews(
        report,
        masks.filter((m) => m.part !== "iron"),
      ),
      project = (p) => mineProjectionAt(p, spec.mine, iron, rest);
    return {
      matches: (p) => Boolean(paintMineFlame(p, spec, project)),
      shift: [0, 0, 0],
      recipe: spec,
      evidence: {
        sourceDepthViews: spec.mine.projectedViews,
        cutHeight: report.cutHeight,
        sourceShiftMM: report.sourceShiftMM,
      },
    };
  }
  if (code === "MH-031") {
    const spec = await read(
        path.join(import.meta.dirname, "majestic-recipes", code + ".json"),
      ),
      rows = await read(
        path.join(root, "models/collections/majestic-highlands/manifest.json"),
      ),
      source = rows.find((row) => row.code === code),
      reference = rows.find((row) => row.code === spec.flameReference),
      part = {
        ...spec.camp.flame,
        awayFromSource: {
          code: reference.code,
          sourceSHA256: reference.sourceSHA256,
          matchMM: 0.06,
          projectTo: { code, sourceSHA256: source.sourceSHA256 },
        },
      };
    assert.equal(source.sourceSHA256, report.model.assets.source.sha256);
    await initializeStructureReferences(
      { surfaceParts: [part] },
      path.join(root, "models/collections/majestic-highlands/manifest.json"),
    );
    return {
      matches: (p) => structureDomain(p, part),
      shift: [...source.mountCenterMM, 0],
      recipe: spec,
      evidence: { flameDomain: part, mountCenterMM: source.mountCenterMM },
    };
  }
  throw Error("Unreviewed procedural fire model: " + code);
}
