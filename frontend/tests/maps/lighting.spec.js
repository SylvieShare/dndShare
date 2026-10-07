import { test, expect } from "@playwright/test";
import { mapPoint, choosePack } from "./editorHelpers";
import { dragTile } from "./editorHelpers";
async function ready(page, extra = "") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=editor${extra}`);
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
test("light presets place onto the map and sunlight sliders persist with undo", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  const panel = page.getByRole("region", { name: "Освещение карты" });
  await expect(
    panel.getByRole("switch", { name: "Освещение", exact: true }),
  ).not.toBeChecked();
  await expect(
    panel.getByRole("switch", { name: "Дневной свет", exact: true }),
  ).toBeDisabled();
  await panel.getByRole("switch", { name: "Освещение", exact: true }).click();
  await panel
    .getByRole("switch", { name: "Дневной свет", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.sun.enabled))
    .toBe(false);
  await panel
    .getByRole("switch", { name: "Дневной свет", exact: true })
    .click();
  const angle = panel.getByRole("slider", {
    name: "Направление дневного света",
    exact: true,
  });
  await angle.fill("90");
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.sun.angle))
    .toBe(90);
  const point = await mapPoint(page, 4.5, 4.5);
  await panel
    .getByRole("button", { name: "Добавить источник света", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Факел", exact: true }).click();
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lights.length))
    .toBe(1);
  expect(
    await page.evaluate(() => window.lastSaved.document.lights[0]),
  ).toMatchObject({ kind: "torch", enabled: true, shadows: true });
  await page
    .getByRole("complementary", { name: "Выбранные элементы" })
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
    .getByRole("button", { name: "Добавить источник света", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Магический свет", exact: true })
    .press("Enter");
  await page.mouse.move(point.x + 10, point.y + 10);
  await page.mouse.click(point.x + 10, point.y + 10);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lights.length))
    .toBe(1);
  await page
    .getByRole("complementary", { name: "Выбранные элементы" })
    .getByRole("button", { name: "Привязать", exact: true })
    .click();
  await page.mouse.click(point.x - 20, point.y - 20);
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.lights[0].anchor?.kind),
    )
    .toBe("tile");
  const parent = await page.evaluate(
    () => window.lastSaved.document.lights[0].anchor.id,
  );
  await page
    .getByRole("complementary", { name: "Выбранные элементы" })
    .getByRole("button", { name: "Пол 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Области", exact: true }).click();
  const areas = page.getByRole("region", { name: "Области карты" });
  await areas
    .getByRole("button", { name: "Создать область", exact: true })
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

test("lighting mode restores fixed light and an unchecked marker keeps its source active", async ({
  page,
}) => {
  await ready(page, "&lightExample&shaped&lit");
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  const panel = page.getByRole("region", { name: "Освещение карты" });
  await panel.getByRole("button", { name: "Факел", exact: true }).click();
  await page
    .getByRole("complementary", { name: "Выбранные элементы" })
    .getByRole("switch", { name: "Показывать сферу источника", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.lights[0].showMarker),
    )
    .toBe(false);
  expect(
    await page.evaluate(() => window.lastSaved.document.lights[0].enabled),
  ).toBe(true);
  await panel.getByRole("switch", { name: "Освещение", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lightingEnabled))
    .toBe(false);
  await expect(
    panel.getByRole("switch", { name: "Дневной свет", exact: true }),
  ).toBeDisabled();
  const fixed = await colour(page);
  await panel.getByRole("switch", { name: "Освещение", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lightingEnabled))
    .toBe(true);
  const lit = await colour(page);
  expect(lit).not.toBe(fixed);
  expect(
    await page.evaluate(() => window.lastSaved.document.lights[0].showMarker),
  ).toBe(false);
});

test("copied lights paste repeatedly at the current cursor and cancel with Escape or right click", async ({
  page,
}) => {
  await ready(page, "&lightExample&shaped&lit");
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  const panel = page.getByRole("region", { name: "Освещение карты" });
  await expect(
    page.getByRole("menu", { name: "Пресет источника света" }),
  ).toHaveCount(0);
  await panel.getByRole("button", { name: "Факел", exact: true }).click();
  await page.keyboard.press("Control+c");
  for (const [index, x] of [7.5, 8.5].entries()) {
    const point = await mapPoint(page, x, 5.5);
    await page.mouse.move(point.x, point.y);
    await page.keyboard.press("Control+v");
    // Click at the existing cursor without an intervening move.
    await page.mouse.down();
    await page.mouse.up();
    await expect
      .poll(() => page.evaluate(() => window.lastSaved?.document.lights.length))
      .toBe(index + 2);
  }
  const lights = await page.evaluate(() => window.lastSaved.document.lights);
  expect(lights[1]).toMatchObject({
    color: lights[0].color,
    kind: "torch",
    height: lights[0].height,
    showMarker: true,
  });
  expect(lights[1].x).toBeCloseTo(7.5, 5);
  expect(lights[1].y).toBeCloseTo(5.5, 5);
  expect(lights[2].shadows).toBe(false);
  expect(new Set(lights.map((l) => l.id)).size).toBe(3);
  for (const cancel of ["Escape", "right"]) {
    await page.keyboard.press("Control+v");
    if (cancel === "right")
      await page.mouse.click(
        (await mapPoint(page, 8, 7)).x,
        (await mapPoint(page, 8, 7)).y,
        { button: "right" },
      );
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(1400);
    expect(
      await page.evaluate(() => window.lastSaved.document.lights.length),
    ).toBe(3);
  }
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a copied source sits on a raised model and copying a tile replaces the light buffer", async ({
  page,
}) => {
  await ready(page, "&lightExample&shaped&lit");
  await choosePack(page, "ultimate-dungeon");
  const upper = await mapPoint(page, 5, 6.5);
  await dragTile(page, upper, { name: "Каркас 2×1" });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) =>
          t.modelId.startsWith("7777"),
        ),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  await page
    .getByRole("region", { name: "Освещение карты" })
    .getByRole("button", { name: "Факел", exact: true })
    .click();
  await page.keyboard.press("Meta+c");
  await page.mouse.move(upper.x, upper.y);
  await page.keyboard.press("Meta+v");
  await page.mouse.down();
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lights.length))
    .toBe(2);
  expect(
    await page.evaluate(() => window.lastSaved.document.lights[1].elevation),
  ).toBeGreaterThan(0.55);
  await page.getByRole("button", { name: "Плитки", exact: true }).click();
  await choosePack(page, "lost-cave");
  await dragTile(page, await mapPoint(page, 8.5, 7.5));
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) => t.x === 8 && t.y === 7),
      ),
    )
    .toBe(true);
  const count = await page.evaluate(
    () => window.lastSaved.document.tiles.length,
  );
  await page.keyboard.press("Control+c");
  const target = await mapPoint(page, 9.5, 7.5);
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press("Control+v");
  await page.mouse.down();
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.tiles.length))
    .toBe(count + 1);
  expect(
    await page.evaluate(() => window.lastSaved.document.lights.length),
  ).toBe(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
