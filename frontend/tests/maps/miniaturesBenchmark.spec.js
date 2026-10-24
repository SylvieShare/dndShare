import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test(
  "records a field with 40 real pilot miniatures",
  { tag: "@local-model" },
  async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const root = path.resolve(import.meta.dirname, "../../..");
    const folder = path.join(root, "models/creatures/pilot-20261024");
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(root, "scripts/creatures/pilot-production.json"),
      ),
    );
    test.skip(
      manifest.entries.some(
        (e) =>
          !fs.existsSync(path.join(folder, e.slug, "final/verification.json")),
      ),
      "Requires the reviewed local pilot GLBs",
    );
    const assets = new Map();
    function modelAssets(id, files) {
      return Object.fromEntries(
        ["render", "lod", "shadow"].map((role) => {
          const url = `/__miniatures/${id}/${role}.glb`;
          assets.set(url, files[role]);
          return [`${role}Url`, url];
        }),
      );
    }
    const models = manifest.entries.map((entry) => {
      const recipe = JSON.parse(
        fs.readFileSync(path.join(folder, entry.slug, "recipe.json")),
      );
      const stats = JSON.parse(
        fs.readFileSync(
          path.join(folder, entry.slug, "final/model-stats.json"),
        ),
      );
      const files = Object.fromEntries(
        stats.map((s) => [
          s.role,
          path.join(folder, entry.slug, "final", s.file),
        ]),
      );
      return {
        id: recipe.modelId,
        definitionId: recipe.sourceCode,
        sourceCode: recipe.sourceCode,
        name: recipe.name,
        tileType: "object",
        category: "object",
        width: 1,
        height: 1,
        mountDepth: 0,
        surfaceHeight: 0,
        maxHeight: stats.find((s) => s.role === "render").bounds[1][1],
        referenceDiameter: recipe.referenceDiameter,
        itemIds: [entry.itemId],
        nominalSize: entry.size,
        ...modelAssets(entry.slug, files),
        assetBytes: Object.fromEntries(stats.map((s) => [s.role, s.bytes])),
      };
    });
    const bases = [
      [0.5, "dfde5fa7-4bb1-5909-a039-06cd45d0f008"],
      [1, "3c506a01-f906-5627-a53e-e1198a33968a"],
      [2, "ece4f0e5-ae3a-5d3b-a050-5e8a504c33f7"],
    ].map(([size, id]) => {
      const file = path.join(
        root,
        `models/creatures/separated-bases-20261024/${id}.glb`,
      );
      return {
        id,
        definitionId: `BASE-${size}`,
        name: "Подставка",
        tileType: "object",
        category: "creature-base",
        width: 1,
        height: 1,
        maxHeight: 0.06,
        surfaceHeight: 0.06,
        mountDepth: 0,
        baseSize: size,
        referenceDiameter: 0.9 * size,
        ...modelAssets(id, { render: file, lod: file, shadow: file }),
      };
    });
    test.skip(
      [...assets.values()].some((f) => !fs.existsSync(f)),
      "Requires the existing separate base assets",
    );
    const errors = [];
    const loaded = new Set();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /THREE|shader|WebGL/.test(m.text()))
        errors.push(m.text());
    });
    let floorBytes;
    await page.route("**/__miniatures/**", (route) => {
      const url = new URL(route.request().url()).pathname;
      if (url.endsWith("/floor.glb")) {
        if (route.request().method() === "PUT") {
          floorBytes = route.request().postDataBuffer();
          return route.fulfill({ status: 204 });
        }
        return route.fulfill({
          body: floorBytes,
          contentType: "model/gltf-binary",
        });
      }
      if (url.endsWith("pilot.json"))
        return route.fulfill({ json: { models, bases } });
      loaded.add(url);
      return route.fulfill({
        path: assets.get(url),
        contentType: "model/gltf-binary",
      });
    });
    await page.addInitScript(() => {
      window.benchmarkDraws = 0;
      for (const name of [
        "drawElements",
        "drawElementsInstanced",
        "drawArrays",
        "drawArraysInstanced",
      ]) {
        const original = WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name] = function (...args) {
          window.benchmarkDraws++;
          return original.apply(this, args);
        };
      }
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/tests/maps/fixtures/miniatureBenchmark.html");
    await page.waitForFunction(() => window.benchmark?.ready, null, {
      timeout: 60000,
    });
    const results = [];
    for (const [forceLod, shadows] of [
      [true, false],
      [false, false],
      [true, true],
      [false, true],
    ]) {
      await page.evaluate(
        ([l, s]) => window.benchmark.phase(l, s),
        [forceLod, shadows],
      );
      await page
        .waitForFunction(
          () => window.benchmark.progress?.remaining === 0,
          null,
          { timeout: 30000 },
        )
        .catch(async (error) => {
          console.log(
            "PILOT_LOAD_FAILURE",
            JSON.stringify(
              await page.evaluate(() => ({
                progress: window.benchmark.progress,
                errors: window.benchmark.errors,
              })),
            ),
          );
          throw error;
        });
      await page.waitForTimeout(800);
      const metrics = await page.evaluate(async () => {
        const gl = document.querySelector("canvas").getContext("webgl2"),
          ext = gl.getExtension("WEBGL_debug_renderer_info");
        const times = [];
        let previous;
        for (let i = 0; i < 40; i++) {
          await new Promise((resolve) =>
            requestAnimationFrame((now) => {
              if (previous) times.push(now - previous);
              previous = now;
              window.benchmark.rotate(Math.sin(i * 0.15) * 8);
              resolve();
            }),
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
        const draws = window.benchmarkDraws;
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const sorted = times.slice(3).sort((a, b) => a - b);
        return {
          renderer: ext
            ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl.RENDERER),
          frameMedianMs: sorted[Math.floor(sorted.length * 0.5)],
          frameP95Ms: sorted[Math.floor(sorted.length * 0.95)],
          sample: window.benchmark.sample,
          errors: window.benchmark.errors,
          idleDraws: window.benchmarkDraws - draws,
          progress: window.benchmark.progress,
        };
      });
      expect(metrics.errors).toEqual([]);
      expect(metrics.idleDraws).toBe(0);
      expect(metrics.sample.triangles).toBeGreaterThan(100000);
      results.push({ forceLod, shadows, ...metrics });
    }
    await page.screenshot({ path: testInfo.outputPath("pilot-field.png") });
    expect(errors).toEqual([]);
    expect(results[1].sample.triangles).toBeGreaterThan(
      results[0].sample.triangles * 1.4,
    );
    expect(loaded.size).toBeGreaterThanOrEqual(19);
    const report = {
      tokens: 40,
      species: 8,
      viewport: [1920, 1080],
      results,
      loadedFiles: [...loaded],
    };
    await testInfo.attach("pilot-metrics", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
    console.log("MINIATURES_PILOT", JSON.stringify(report));
    await page.evaluate(() => window.benchmark.close());
  },
);
