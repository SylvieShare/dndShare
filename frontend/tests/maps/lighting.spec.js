import { test, expect } from "@playwright/test";
import { mapPoint } from "./editorHelpers";
import { dragTile } from "./editorHelpers";
async function ready(page, extra = "") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=editor${extra}`);
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
test("light sources drag onto the map and sunlight sliders persist with undo", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  const panel = page.getByRole("region", { name: "Освещение карты" });
  await panel
    .getByRole("switch", { name: "Солнечный свет", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.sun.enabled))
    .toBe(false);
  await panel
    .getByRole("switch", { name: "Солнечный свет", exact: true })
    .click();
  const angle = panel.getByRole("slider", {
    name: "Направление солнца",
    exact: true,
  });
  await angle.fill("90");
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.sun.angle))
    .toBe(90);
  const point = await mapPoint(page, 4.5, 4.5);
  const preset = panel.getByRole("button", { name: "Факел", exact: true });
  await preset.hover();
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lights.length))
    .toBe(1);
  expect(
    await page.evaluate(() => window.lastSaved.document.lights[0]),
  ).toMatchObject({ kind: "torch", enabled: true, shadows: true });
  await panel
    .getByRole("slider", { name: "Высота источника", exact: true })
    .fill("1.5");
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.lights[0].height),
    )
    .toBe(1.5);
  await page.getByTitle("Отменить · Ctrl/Cmd+Z", { exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.lights[0].height),
    )
    .toBe(0.9);
  expect(errors).toEqual([]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
async function colour(page) {
  const style = await page.addStyleTag({
    content:
      '.map-canvas > :not(.map-canvas-surface), [aria-label="Действия карты"] {visibility:hidden!important}',
  });
  const png = await page.locator(".map-canvas canvas").screenshot();
  await style.evaluate((n) => n.remove());
  return page.evaluate(async (base64) => {
    const b = await createImageBitmap(
      new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
        type: "image/png",
      }),
    );
    const c = new OffscreenCanvas(b.width, b.height),
      ctx = c.getContext("2d");
    ctx.drawImage(b, 0, 0);
    b.close();
    const p = ctx.getImageData(0, 0, c.width, c.height).data;
    let red = 0;
    for (let i = 0; i < p.length; i += 4)
      if (p[i] > p[i + 2] + 10 && p[i] > p[i + 1] + 5) red += p[i] - p[i + 2];
    return red;
  }, png.toString("base64"));
}
test("a local warm light actually changes PBR shading with sunlight off", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /THREE|WebGL|shader/.test(m.text()))
      errors.push(m.text());
  });
  await ready(page, "&lightExample&shaped");
  const dark = await colour(page);
  await ready(page, "&lightExample&shaped&lit");
  const lit = await colour(page);
  expect(lit).toBeGreaterThan(dark + 1000);
  expect(errors).toEqual([]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a source binds to a selected tile, follows it and belongs to its hidden area", async ({
  page,
}) => {
  await ready(page);
  const point = await mapPoint(page, 4.5, 4.5);
  await dragTile(page, point);
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  const panel = page.getByRole("region", { name: "Освещение карты" });
  await panel
    .getByRole("button", { name: "Магический свет", exact: true })
    .press("Enter");
  await page.mouse.move(point.x + 10, point.y + 10);
  await page.mouse.click(point.x + 10, point.y + 10);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lights.length))
    .toBe(1);
  await page.mouse.click(point.x - 20, point.y - 20);
  await panel
    .getByRole("button", { name: "Привязать к выбранной модели", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.lights[0].anchor?.kind),
    )
    .toBe("tile");
  const parent = await page.evaluate(
    () => window.lastSaved.document.lights[0].anchor.id,
  );
  await page.getByRole("button", { name: "Области", exact: true }).click();
  const areas = page.getByRole("region", { name: "Области карты" });
  await areas
    .getByRole("button", { name: "Создать область", exact: true })
    .click();
  await areas
    .getByRole("button", { name: "Добавить выбранное (1)", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "Скрыть область «Область 1»", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.areas[0]?.hidden),
    )
    .toBe(true);
  expect(
    await page.evaluate(() => window.lastSaved.document.areas[0].tileIds),
  ).toEqual([parent]);
});

test("a wall shadow reduces direct light on the receiver behind it", async ({
  page,
}) => {
  await ready(page, "&lightExample&shaped&lit&noShadow");
  const unshadowed = await colour(page);
  await ready(page, "&lightExample&shaped&lit");
  const shadowed = await colour(page);
  expect(shadowed).toBeLessThan(unshadowed - 1000);
});
