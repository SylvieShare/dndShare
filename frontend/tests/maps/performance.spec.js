import { expect, test } from "@playwright/test";

async function drawCounter(page, disableGpu = false) {
  await page.addInitScript((disable) => {
    window.mainDrawCalls = 0;
    window.gpuQueries = 0;
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
          if (!draw) continue;
          gl[name] = function (...values) {
            if (gl.canvas.closest(".map-canvas-surface"))
              window.mainDrawCalls++;
            return draw.apply(this, values);
          };
        }
        const extension = gl.getExtension;
        gl.getExtension = function (name) {
          return disable && name === "EXT_disjoint_timer_query_webgl2"
            ? null
            : extension.call(this, name);
        };
        const begin = gl.beginQuery;
        gl.beginQuery = function (...values) {
          window.gpuQueries++;
          return begin.apply(this, values);
        };
      }
      return gl;
    };
  }, disableGpu);
}
for (const mobile of [false, true])
  test(`performance tab shows measured frame work without waking an idle map ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /WebGL|INVALID|Shader/.test(m.text()))
        errors.push(m.text());
    });
    await drawCounter(page, true);
    await page.setViewportSize(
      mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
    );
    await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
    await expect(page.locator(".map-canvas canvas")).toBeVisible();
    expect(await page.evaluate(() => window.gpuQueries)).toBe(0);
    await page
      .getByRole("button", { name: "Производительность", exact: true })
      .click();
    const panel = page.getByRole("region", { name: "Нагрузка", exact: true });
    await expect(panel).toBeVisible();
    await expect(
      panel.getByText(
        "GPU-таймер недоступен в этом браузере. Показаны замеры CPU.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect
      .poll(() =>
        panel.locator(".map-performance-summary strong").first().textContent(),
      )
      .toMatch(/мс/);
    await expect(
      panel.getByRole("img", {
        name: "CPU: время кадра по этапам за 30 секунд",
      }),
    ).toBeVisible();
    await expect(panel.getByText("Покой", { exact: true })).toBeVisible();
    const draws = await page.evaluate(() => window.mainDrawCalls);
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.mainDrawCalls)).toBe(draws);
    await panel
      .getByRole("switch", { name: "Измерять нагрузку", exact: true })
      .click();
    await expect(panel.getByText("Пауза", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
test("session performance tab uses the same profiler and GPU sampling ends when the section closes", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await drawCounter(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=session&lightExample&lit",
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Производительность", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Нагрузка", exact: true });
  await expect(panel).toBeVisible();
  await expect
    .poll(() =>
      panel.locator(".map-performance-summary strong").first().textContent(),
    )
    .toMatch(/мс/);
  const gpuOption = panel.getByRole("option", {
    name: "GPU · отрисовка",
    exact: true,
  });
  if (await gpuOption.isEnabled()) {
    await expect
      .poll(() =>
        panel.locator(".map-performance-summary strong").nth(1).textContent(),
      )
      .toMatch(/мс/);
    expect(await page.evaluate(() => window.gpuQueries)).toBeGreaterThan(0);
    await expect(
      panel.getByText("Плитки со светом", { exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await page.waitForTimeout(500);
  const queries = await page.evaluate(() => window.gpuQueries);
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.gpuQueries)).toBe(queries);
  expect(errors).toEqual([]);
});
