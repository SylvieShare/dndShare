import { expect, test } from "@playwright/test";
import { choosePack, pickTile } from "./editorHelpers";

test('Metal measures one GPU query per frame without inventing a flame breakdown', {tag:'@gpu'}, async ({page})=>{
  await drawCounter(page);
  await page.goto('/tests/maps/fixtures/maps.html?mode=editor&componentsExample&sixFires');
  await expect(page.locator('.map-canvas canvas')).toBeVisible();
  const metal=await page.evaluate(()=>{const gl=document.querySelector('.map-canvas canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext&&/Metal/i.test(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));});
  test.skip(!metal,'ANGLE Metal is required');
  await page.getByRole('button',{name:'Производительность',exact:true}).click();
  const panel=page.getByRole('region',{name:'Нагрузка',exact:true});
  await expect(panel.getByText(/На Metal измеряется кадр целиком/)).toBeVisible();
  await expect(panel.locator('.map-performance-parts').getByText('Кадр целиком',{exact:true})).toBeVisible();
  await expect(panel.locator('.map-performance-parts').getByText('Огонь',{exact:true})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>window.gpuQueryFrames.length)).toBeGreaterThanOrEqual(3);
  expect(await page.evaluate(()=>window.gpuQueryFrames.slice(-3))).toEqual([1,1,1]);
  await page.getByRole('button',{name:'Освещение',exact:true}).click();
  const samples=await page.evaluate(()=>window.gpuQueryFrames.length);await page.waitForTimeout(1000);
  expect(await page.evaluate(()=>window.gpuQueryFrames.length)).toBe(samples);
});

test("GPU accounts for all six flames before and after toggling without leaving extra passes", { tag: "@gpu" }, async ({
  page,
}) => {
  await drawCounter(page);
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=editor&componentsExample&sixFires",
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Производительность", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Нагрузка", exact: true });
  const gpu = panel.getByRole("option", {
    name: "GPU · отрисовка",
    exact: true,
  });
  test.skip(!(await gpu.isEnabled()), "GPU timer unavailable in this browser");
  test.skip(await panel.getByText(/На Metal измеряется кадр целиком/).isVisible(),
    "This backend measures whole frames rather than individual GPU parts");
  await expect(
    panel.locator(".map-performance-parts").getByText("Огонь", { exact: true }),
  ).toBeVisible();
  const calls = async () =>
    Number(
      (
        await panel
          .locator(".map-performance-details > div")
          .first()
          .locator("dd")
          .textContent()
      ).replace(/\s/g, ""),
    );
  await expect.poll(calls).toBe(9);
  await expect
    .poll(() => page.evaluate(() => window.gpuQueryFrames.length))
    .toBeGreaterThanOrEqual(3);
  const initialSegments = await page.evaluate(() =>
    window.gpuQueryFrames.at(-1),
  );
  await expect
    .poll(() => page.evaluate(() => window.gpuQueryFrames.slice(-3)))
    .toEqual([initialSegments, initialSegments, initialSegments]);
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  await page
    .getByRole("button", { name: "Пол 1 · Свет", exact: true })
    .first()
    .click();
  const toggle = page.getByRole("switch", {
    name: "Показывать пламя",
    exact: true,
  });
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  const previousSamples = await page.evaluate(
    () => window.gpuQueryFrames.length,
  );
  await page
    .getByRole("button", { name: "Производительность", exact: true })
    .click();
  await expect(
    panel.locator(".map-performance-parts").getByText("Огонь", { exact: true }),
  ).toBeVisible();
  await expect.poll(calls).toBe(9);
  await expect
    .poll(() => page.evaluate(() => window.gpuQueryFrames.length))
    .toBeGreaterThanOrEqual(previousSamples + 3);
  await expect
    .poll(() => page.evaluate(() => window.gpuQueryFrames.slice(-3)))
    .toEqual([initialSegments, initialSegments, initialSegments]);
});

test("forced LOD persists, survives zoom and applies to moving previews without full downloads", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("dndshare.maps.force-lod", "true"),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Производительность", exact: true })
    .click();
  const setting = page.getByRole("switch", {
    name: "Всегда использовать LOD-модели",
    exact: true,
  });
  await expect(setting).toBeChecked();
  for (let i = 0; i < 6; i++)
    await page.getByTitle("Увеличить", { exact: true }).click();
  await page.getByRole("button", { name: "Плитки", exact: true }).click();
  await choosePack(page, "ultimate-dungeon");
  await pickTile(page, "Каменный пол");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.loadedModels.filter((url) =>
          url.includes("88888888-8888-4888-8888-888888888888"),
        ),
      ),
    )
    .toEqual(["/api/maps/models/88888888-8888-4888-8888-888888888888/lod"]);
  expect(
    await page.evaluate(() =>
      window.loadedModels.some((url) => url.endsWith("/render")),
    ),
  ).toBe(false);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Производительность", exact: true })
    .click();
  await setting.click();
  await expect(setting).not.toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.loadedModels.some((url) => url.endsWith("/render")),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(() => localStorage.getItem("dndshare.maps.force-lod")),
  ).toBe("false");
  expect(await page.evaluate(() => window.requests)).toEqual([]);
});

async function drawCounter(page, disableGpu = false) {
  await page.addInitScript((disable) => {
    window.mainDrawCalls = 0;
    window.gpuQueries = 0;
    window.gpuQueryFrames = [];
    let frameQueries = 0;
    function recordFrame() {
      if (frameQueries) window.gpuQueryFrames.push(frameQueries);
      frameQueries = 0;
      requestAnimationFrame(recordFrame);
    }
    requestAnimationFrame(recordFrame);
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
          if (gl.canvas.closest(".map-canvas-surface")) frameQueries++;
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
