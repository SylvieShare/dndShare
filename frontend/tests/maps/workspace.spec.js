import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";

async function readyEditor(page) {
  await expect(page.locator(".map-editor-workspace")).toBeVisible();
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
}

for (const mobile of [false, true])
  test(`editor fills the viewport and returns to the library ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    const viewport = mobile
      ? { width: 430, height: 932 }
      : { width: 1440, height: 1000 };
    await page.setViewportSize(viewport);
    await page.goto("/tests/maps/fixtures/maps.html?mode=library");
    await page
      .getByRole("button", { name: "Открыть карту Крепость на переправе" })
      .click();
    await readyEditor(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const bounds = await page.locator(".map-editor-workspace").boundingBox();
    expect(bounds).toEqual({ x: 0, y: 0, ...viewport });
    const canvas = await page.locator(".map-canvas-surface").boundingBox();
    expect(canvas.height).toBeGreaterThan(mobile ? 300 : 700);
    const back = page.getByRole("button", { name: "Закрыть редактор" });
    const offset = await back.evaluate(button => {
      const icon = button.querySelector(':scope > svg').getBoundingClientRect();
      const label = button.querySelector(':scope > span').getBoundingClientRect();
      return Math.abs(icon.y + icon.height / 2 - label.y - label.height / 2);
    });
    expect(offset).toBeLessThan(1);
    await back.click();
    await expect(
      page.getByRole("button", { name: "Создать карту", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.mapRoute())).toBe("/maps");
  });

test("copy assigns its saved URL, keeps editing and can be reopened", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=library");
  await page.getByTitle("Дублировать карту").click();
  await readyEditor(page);
  await expect(
    page.getByRole("button", { name: "Сохранить", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.mapRoute()))
    .toBe("/maps/editor?id=test-copy");
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const b = await page.locator(".map-canvas-surface").boundingBox();
  const s = Math.min((b.width - 40) / 12, (b.height - 40) / 10);
  await dragTile(page, {
    x: b.x + b.width / 2 - 1.5 * s,
    y: b.y + b.height / 2 - 0.5 * s,
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) => t.x === 4 && t.y === 4),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Закрыть редактор" }).click();
  await page
    .getByRole("button", {
      name: "Открыть карту Крепость на переправе · копия",
    })
    .click();
  await readyEditor(page);
  expect(await page.evaluate(() => window.mapRoute())).toBe(
    "/maps/editor?id=test-copy",
  );
});

test("camera rotates with right drag without painting tiles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await readyEditor(page);
  const canvas = page.locator(".map-canvas canvas");
  const original = await canvas.screenshot();
  const initial = await page.locator(".map-canvas-surface").boundingBox();
  await page.mouse.move(
    initial.x + initial.width / 2,
    initial.y + initial.height / 2,
  );
  await page.mouse.down({ button: "right" });
  await page.mouse.move(
    initial.x + initial.width / 2 + 120,
    initial.y + initial.height / 2,
    { steps: 5 },
  );
  await page.mouse.up({ button: "right" });
  expect((await canvas.screenshot()).equals(original)).toBe(false);
  await page.getByTitle("Вид сверху", { exact: true }).click();
  await expect(
    page.getByTitle("Изометрический вид", { exact: true }),
  ).toBeVisible();
  const b = await page.locator(".map-canvas-surface").boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(b.x + b.width / 2 + 120, b.y + b.height / 2 - 120, {
    steps: 5,
  });
  await page.mouse.up({ button: "right" });
  await expect(page.getByTitle("Вид сверху", { exact: true })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1400);
  expect(await page.evaluate(() => window.requests)).toEqual([]);
});

test("leaving a conflicted editor preserves changes until discard is confirmed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await readyEditor(page);
  await page.evaluate(() => {
    window.failNextSave = 409;
  });
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const b = await page.locator(".map-canvas-surface").boundingBox();
  await dragTile(page, await mapPoint(page, 4.5, 4.5));
  await expect(page.getByRole("alert")).toContainText("другой вкладке");
  await page
    .getByRole("button", { name: "Вернуться к карте", exact: true })
    .click();
  await page.getByRole("button", { name: "Закрыть редактор" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Продолжить редактирование" }).click();
  await expect(page.locator(".map-editor-workspace")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть редактор" }).click();
  await page.getByRole("button", { name: "Закрыть без сохранения" }).click();
  await expect(
    page.getByRole("button", { name: "Создать карту", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
