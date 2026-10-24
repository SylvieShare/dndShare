import { test, expect } from "@playwright/test";
import path from "node:path";
import { miniatureBenchmarkAssets } from "./fixtures/miniatureBenchmarkAssets";
import { benchmarkMetrics } from "./fixtures/miniatureBenchmarkMetrics";

test(
  "records 40 real miniatures in an open field and a lit room",
  { tag: "@local-model" },
  async ({ page, browser }, testInfo) => {
    test.setTimeout(360000);
    const root = path.resolve(import.meta.dirname, "../../..");
    const folder = path.resolve(
      root,
      process.env.DNDSHARE_MINIATURE_ROOT || "models/creatures/pilot-20261024",
    );
    const fixture = miniatureBenchmarkAssets(root, folder),
      { assets } = fixture;
    test.skip(
      fixture.missing.length > 0,
      "Requires local pilot, bases and prepared LC wall/floor GLBs",
    );
    const errors = [],
      loaded = new Set();
    let floorBytes;
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /THREE|shader|WebGL/.test(m.text()))
        errors.push(m.text());
    });
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
        return route.fulfill({
          json: {
            models: fixture.models,
            bases: fixture.bases,
            scenery: fixture.scenery,
          },
        });
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
    const results = [],
      hardware = process.env.DNDSHARE_TEST_HARDWARE === "1";
    let system;
    if (hardware) {
      const cdp = await browser.newBrowserCDPSession();
      const info = await cdp.send("SystemInfo.getInfo");
      system = { gpu: info.gpu.devices, featureStatus: info.gpu.featureStatus };
      await cdp.detach();
    }
    for (const room of [false, true])
      for (const [forceLod, shadows] of [
        [true, false],
        [false, false],
        [true, true],
        [false, true],
      ]) {
        const started = Date.now();
        await page.evaluate(
          (args) => window.benchmark.phase(...args),
          [forceLod, shadows, room],
        );
        await page.waitForFunction(
          () => window.benchmark.progress?.remaining === 0,
          null,
          { timeout: 60000 },
        );
        await page.waitForTimeout(800);
        const warmupMs = Date.now() - started;
        const metrics = await benchmarkMetrics(page, hardware ? 80 : 20);
        if (hardware) {
          expect(metrics.renderer).not.toMatch(
            /SwiftShader|llvmpipe|software|lavapipe/i,
          );
          expect(metrics.sample.gpuSupported).toBe(true);
        }
        expect(metrics.errors).toEqual([]);
      expect(metrics.readbackError).toBe(0);
        expect(metrics.idleDraws).toBe(0);
        expect(metrics.sample.triangles).toBeGreaterThan(100000);
        results.push({ room, forceLod, shadows, warmupMs, ...metrics });
        console.log(
          "MINIATURE_PHASE",
          JSON.stringify({
            room,
            forceLod,
            shadows,
            median: metrics.frameMedianMs,
            gpu: metrics.sample.gpu,
            textureBytes: metrics.progress.memory.textureBytes,
          }),
        );
        if (room && shadows && !forceLod)
          await page.screenshot({
            path: testInfo.outputPath("pilot-room.png"),
          });
      }
    expect(errors).toEqual([]);
    expect(results[1].sample.triangles).toBeGreaterThan(
      results[0].sample.triangles * 1.4,
    );
    const report = {
      tokens: 40,
      species: 8,
      viewport: [1920, 1080],
      hardware,
      system,
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
