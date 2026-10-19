import { expect, test } from "@playwright/test";

test("an inactive map stops animation draws and resumes with its scene intact", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.auditDraws = 0;
    const original = HTMLCanvasElement.prototype.getContext,
      seen = new WeakSet();
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = original.apply(this, args);
      if (gl && String(args[0]).startsWith("webgl") && !seen.has(gl)) {
        seen.add(gl);
        for (const name of [
          "drawArrays",
          "drawElements",
          "drawArraysInstanced",
          "drawElementsInstanced",
        ]) {
          const draw = gl[name];
          if (draw)
            gl[name] = function (...values) {
              if (gl.canvas.closest(".map-canvas-surface")) window.auditDraws++;
              return draw.apply(this, values);
            };
        }
      }
      return gl;
    };
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=editor&componentsExample",
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.auditDraws))
    .toBeGreaterThan(5);
  await page.evaluate(() => {
    const root = document.querySelector(".map-editor-workspace");
    let component = root.__vueParentComponent;
    while (component && !component.type.__file?.endsWith("/MapEditor.vue"))
      component = component.parent;
    window.auditComponent = component;
    component.props.active = false;
    root.style.display = "none";
  });
  await page.waitForTimeout(200);
  const paused = await page.evaluate(() => window.auditDraws);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.auditDraws)).toBe(paused);
  await page.evaluate(() => {
    document.querySelector(".map-editor-workspace").style.display = "";
    window.auditComponent.props.active = true;
  });
  await expect
    .poll(() => page.evaluate(() => window.auditDraws))
    .toBeGreaterThan(paused);
  expect(errors).toEqual([]);
});

test("complex model BVHs are built in a worker and preserve geometric hits", async ({
  page,
}) => {
  await page.goto("/tests/maps/fixtures/bvhPicking.html");
  await page.waitForFunction(() => window.bvhAudit || window.bvhError);
  expect(await page.evaluate(() => window.bvhError)).toBeUndefined();
  const result = await page.evaluate(() => window.bvhAudit);
  expect(result.sameBuffers).toBe(true);
  expect(result.maximumDistanceError).toBeLessThan(1e-7);
  expect(result.wrongInstances).toBe(0);
  expect(result.bytes).toBeGreaterThan(0);
  console.log(JSON.stringify({ modelPickingBenchmark: result }));
});
