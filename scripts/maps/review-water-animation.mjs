// Read-only GPU review of current catalogue assets. Publication is a separate MCP step.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { localModelAsset } from "./local_model_assets.mjs";
const root = path.resolve(import.meta.dirname, "../.."),
  require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("@playwright/test");
export async function openWaterReview(baseURL = "http://127.0.0.1:5194") {
  const browser = await chromium.launch({ headless: true }),
    page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const paths = new Map(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/water-review/*.glb", (route) => {
    const file = paths.get(path.basename(route.request().url()));
    return file
      ? route.fulfill({ path: file, contentType: "model/gltf-binary" })
      : route.abort();
  });
  await page.goto(baseURL + "/tests/maps/fixtures/waterMaterials.html");
  await page.waitForFunction(() => window.reviewWaterMaterials);
  return {
    async continuity() {
      errors.length = 0;
      const changed = await page.evaluate(() => window.waterContinuity());
      assert.equal(errors.length, 0, errors.join("\n").slice(0, 2000));
      assert.ok(changed < 8, "Waves depend on model origin: " + changed);
      return changed;
    },
    async review(row, output) {
      assert.ok(row.profile);
      const { model, profile } = row;
      assert.match(model.sourceCode, /^[A-Z0-9]+-\d{3}$/);
      const results = {};
      for (const tier of ["render", "lod"]) {
        const asset = model.assets[tier],
          file = await localModelAsset(asset),
          bytes = await fs.readFile(file);
        assert.equal(
          createHash("sha256").update(bytes).digest("hex"),
          asset.sha256,
        );
        paths.set(asset.sha256 + ".glb", file);
        errors.length = 0;
        let result = await page.evaluate(
          ({ tier, model, profile }) =>
            window.reviewWaterMaterials(tier, model, profile),
          { tier, model, profile },
        );
        if (result.wetPixels < 20) {
          result = await page.evaluate(
            ({ tier, model, profile }) =>
              window.reviewWaterMaterials(tier, model, profile, 180),
            { tier, model, profile },
          );
          result.angleUsed = 180;
        }
        assert.equal(
          errors.length,
          0,
          model.sourceCode + " " + errors.join("\n").slice(0, 2000),
        );
        assert.ok(
          result.animated > 5,
          `${model.sourceCode} ${tier}: no visible animated water (${result.animated}, wet ${result.wetPixels})`,
        );
        assert.equal(
          result.sameChanged,
          0,
          `${model.sourceCode} ${tier}: animation is not held at 12 FPS`,
        );
        assert.ok(
          result.dryChanged < 12,
          `${model.sourceCode} ${tier}: dry surfaces changed ${result.dryChanged}`,
        );
        assert.ok(
          result.frozen,
          `${model.sourceCode} ${tier}: off state is not static`,
        );
        if (output && tier === "render") {
          await fs.mkdir(output, { recursive: true });
          await fs.writeFile(
            path.join(output, model.sourceCode + ".png"),
            Buffer.from(result.frameImage.split(",")[1], "base64"),
          );
          await fs.writeFile(
            path.join(output, model.sourceCode + "-mask.png"),
            Buffer.from(result.maskImage.split(",")[1], "base64"),
          );
        }
        delete result.frameImage;
        delete result.maskImage;
        results[tier] = { ...result, sha256: asset.sha256 };
      }
      return results;
    },
    close: () => browser.close(),
  };
}
if (process.argv[1] === import.meta.filename) {
  const file =
    process.argv.find((a) => a.startsWith("--plan="))?.slice(7) ||
    path.join(root, "models/water-animation-plan.json");
  const codes = process.argv
    .find((a) => a.startsWith("--codes="))
    ?.slice(8)
    ?.split(",");
  const rows = JSON.parse(await fs.readFile(file, "utf8")).filter(
    (r) => r.profile && (!codes || codes.includes(r.model.sourceCode)),
  );
  const output = path.join(root, "models/water-animation-review"),
    review = await openWaterReview();
  try {
    console.log("WORLD_WAVES_CONTINUITY", await review.continuity());
    for (const row of rows) {
      const result = await review.review(row, output);
      await fs.writeFile(
        path.join(output, row.model.sourceCode + ".json"),
        JSON.stringify(
          { model: row.model, profile: row.profile, result },
          null,
          2,
        ) + "\n",
      );
      console.log(
        "WATER_REVIEWED",
        row.model.sourceCode,
        JSON.stringify(result),
      );
    }
  } finally {
    await review.close();
  }
}
