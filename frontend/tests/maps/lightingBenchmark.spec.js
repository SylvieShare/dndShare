import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
test("records real-model lighting frame intervals with cached shadows", async ({
  page,
}) => {
  test.setTimeout(120000);
  const root = path.resolve(
    import.meta.dirname,
    "../../../models/prepared/runtime",
  );
  test.skip(
    !fs.existsSync(path.join(root, "LC-001.render.glb")),
    "Local model assets are excluded from Git",
  );
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /THREE|shader|WebGL/.test(m.text()))
      errors.push(m.text());
  });
  await page.route("**/api/maps/models/*/*", async (route) => {
    const p = new URL(route.request().url()).pathname.split("/");
    await route.fulfill({
      path: path.join(
        root,
        `${p[4].startsWith("1111") ? "LC-001" : "LC-007"}.${p[5] === "lod" ? "lod" : "render"}.glb`,
      ),
      contentType: "model/gltf-binary",
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=editor&realModels&lightBenchmark",
  );
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.waitForTimeout(1000);
  const metrics = await page.evaluate(async () => {
    const gl = document
        .querySelector(".map-canvas canvas")
        .getContext("webgl2"),
      ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : "unknown";
    const intervals = [];
    let previous = performance.now();
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 20000);
      function tick(time) {
        intervals.push(time - previous);
        previous = time;
        intervals.length < 30
          ? requestAnimationFrame(tick)
          : (clearTimeout(timer), resolve());
      }
      requestAnimationFrame(tick);
    });
    const samples = intervals.slice(2).sort((a, b) => a - b);
    return {
      renderer,
      frames: intervals.length,
      median: samples[Math.floor(samples.length * 0.5)],
      p95: samples[Math.floor(samples.length * 0.95)],
      average: samples.reduce((a, b) => a + b) / samples.length,
    };
  });
  console.log(
    "LIGHTING_REAL_MODELS",
    JSON.stringify({
      tiles: 324,
      sources: 2,
      sun: true,
      shadowSources: 3,
      ...metrics,
    }),
  );
  expect(errors).toEqual([]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
