import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";
async function ready(page, mode = "editor", extra = "") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=${mode}${extra}`);
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  if (mode === "editor")
    await page.getByTitle("Вид сверху", { exact: true }).click();
}
const areas = (page) => page.getByRole("region", { name: "Области карты" });
const open = (page) =>
  page.getByRole("button", { name: "Области", exact: true }).click();

const focus = (page) =>
  page.getByRole("complementary", { name: "Выбранные элементы", exact: true });
test("the compact area list opens a focus with every model and light, and edits preserve membership", async ({
  page,
}) => {
  await ready(page, "editor", "&areaExample&twoAreaObjects&attachmentExample");
  await open(page);
  await expect(areas(page).getByRole("textbox")).toHaveCount(0);
  await areas(page).getByRole("button", { name: "Зал", exact: true }).click();
  const panel = focus(page);
  await expect(
    panel.getByRole("heading", { name: "Зал", exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".map-area-members .map-entity-row")).toHaveCount(
    6,
  );
  await expect(
    panel.getByRole("button", { name: "Пол 1", exact: true }),
  ).toHaveCount(2);
  await expect(
    panel.getByRole("button", { name: "Сундук", exact: true }),
  ).toHaveCount(2);
  await panel
    .getByRole("button", { name: "Цвет области", exact: true })
    .click();
  await page.getByRole("button", { name: "#22c55e", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.areas[0].color))
    .toBe("#22c55e");
  await panel
    .getByLabel("Название области", { exact: true })
    .fill("Зелёный зал");
  await panel.getByLabel("Название области", { exact: true }).press("Enter");
  await expect(
    areas(page).getByRole("button", { name: "Зелёный зал", exact: true }),
  ).toBeVisible();
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.press("r");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.every((t) => t.rotation === 90) &&
          window.lastSaved.document.objects.every((o) => o.rotation === 90),
      ),
    )
    .toBe(true);
  await expect(
    panel.getByRole("heading", { name: "Зелёный зал", exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("switch", { name: "Скрыть область «Зелёный зал»", exact: true })
    .click();
  await expect(
    panel.getByRole("heading", { name: "Зелёный зал", exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".map-area-members .map-entity-row")).toHaveCount(
    6,
  );
  await panel
    .getByRole("switch", { name: "Скрыть область «Зелёный зал»", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Убрать Пол 1 из области", exact: true })
    .first()
    .click();
  await expect(panel.locator(".map-area-members .map-entity-row")).toHaveCount(
    4,
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.areas[0].tileIds.length),
    )
    .toBe(1);
  await page.getByTitle("Отменить · Ctrl/Cmd+Z", { exact: true }).click();
  await expect(panel.locator(".map-area-members .map-entity-row")).toHaveCount(
    6,
  );
  await panel
    .getByRole("button", { name: "Сундук", exact: true })
    .first()
    .click();
  await expect(
    panel.getByRole("heading", { name: "Сундук", exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".map-area-members")).toHaveCount(0);
  await panel
    .getByRole("button", {
      name: "Перейти к области «Зелёный зал»",
      exact: true,
    })
    .click();
  await expect(panel.locator(".map-area-members .map-entity-row")).toHaveCount(
    6,
  );
  await panel
    .getByRole("button", { name: "Удалить область «Зелёный зал»", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.areas.length))
    .toBe(0);
  expect(
    await page.evaluate(() => [
      window.lastSaved.document.tiles.length,
      window.lastSaved.document.objects.length,
    ]),
  ).toEqual([2, 2]);
});
test("creation captures an ordinary selection, an empty focus stays usable, and models can transfer between areas", async ({
  page,
}) => {
  await ready(page);
  const point = await mapPoint(page, 4.5, 4.5);
  await dragTile(page, point);
  await open(page);
  await areas(page)
    .getByRole("button", { name: "Создать область", exact: true })
    .click();
  const panel = focus(page);
  await panel.getByLabel("Название области", { exact: true }).fill("Вход");
  await panel.getByLabel("Название области", { exact: true }).press("Enter");
  await areas(page)
    .getByRole("button", { name: "Создать область", exact: true })
    .click();
  await expect(
    panel.getByRole("heading", { name: "Область 2", exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".map-area-members .map-entity-row")).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Копировать выбранное", exact: true }),
  ).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.areas.map((a) => a.tileIds.length),
      ),
    )
    .toEqual([1, 0]);
  await areas(page).getByRole("button", { name: "Вход", exact: true }).click();
  await panel
    .getByRole("button", { name: "Убрать Пол 1 из области", exact: true })
    .click();
  await page.mouse.click(point.x, point.y);
  await panel
    .getByRole("button", { name: "Добавить в область", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Область 2", exact: true }).click();
  await panel
    .getByRole("button", { name: "Перейти к области «Область 2»", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Пол 1", exact: true }),
  ).toBeVisible();
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.press("Delete");
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.areas.length))
    .toBe(1);
  expect(
    await page.evaluate(() =>
      window.lastSaved.document.tiles.some((t) => t.x === 4 && t.y === 4),
    ),
  ).toBe(true);
  await page.getByTitle("Отменить · Ctrl/Cmd+Z", { exact: true }).click();
  await expect(
    areas(page).getByRole("button", { name: "Область 2", exact: true }),
  ).toBeVisible();
  await areas(page)
    .getByRole("button", { name: "Область 2", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Пол 1", exact: true }),
  ).toBeVisible();
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect(page.locator(".map-controls-hint")).toContainText(
    "вставить участок",
  );
  await areas(page)
    .getByRole("button", { name: "Область 2", exact: true })
    .click();
  await expect(
    panel.getByRole("heading", { name: "Область 2", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-controls-hint")).not.toContainText(
    "вставить участок",
  );
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});
async function modelPixels(page) {
  const style = await page.addStyleTag({
    content:
      '.map-canvas > :not(.map-canvas-surface), [aria-label="Действия карты"] { visibility: hidden !important; }',
  });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const png = await page.locator(".map-canvas canvas").screenshot();
  await style.evaluate((node) => node.remove());
  return page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(
      new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
        type: "image/png",
      }),
    );
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
      ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const p = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let score = 0;
    const background = (20 * canvas.width + 20) * 4;
    for (let y = 20; y < canvas.height - 20; y++)
      for (let x = 20; x < canvas.width - 20; x++) {
        const i = (y * canvas.width + x) * 4;
        score +=
          Math.abs(p[i] - p[background]) +
          Math.abs(p[i + 1] - p[background + 1]) +
          Math.abs(p[i + 2] - p[background + 2]);
      }
    return score;
  }, png.toString("base64"));
}
for (const mode of ["editor", "screen", "board"])
  test(`hidden areas ${mode === "board" ? "remain faintly visible in session" : `disappear in ${mode}`}`, async ({
    page,
  }) => {
    await ready(page, mode, "&areaExample");
    const normal = await modelPixels(page);
    expect(normal).toBeGreaterThan(10000);
    await ready(page, mode, "&areaExample&hiddenArea");
    const hidden = await modelPixels(page);
    if (mode === "board") {
      expect(hidden).toBeGreaterThan(normal * 0.02);
      expect(hidden).toBeLessThan(normal * 0.4);
    } else expect(hidden).toBeLessThan(normal * 0.01);
  });
