import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";
async function ready(page, extra = "") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=editor${extra}`);
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
const selection = (page) =>
  page.getByRole("complementary", { name: "Выбранные элементы", exact: true });
test("category cells fill each row and single selection shows preview, identity and coordinates on the canvas", async ({
  page,
}) => {
  await ready(page);
  const categories = page.getByRole("toolbar", { name: "Типы тайлов" });
  const bounds = await categories.boundingBox(),
    cells = await categories.getByRole("button").all();
  const first = await cells[0].boundingBox(),
    third = await cells[2].boundingBox();
  expect(first.width).toBeCloseTo((bounds.width - 12) / 3, 0);
  expect(third.x + third.width).toBeCloseTo(bounds.x + bounds.width, 0);
  expect(first.height).toBe(80);
  await expect(cells[0].locator("img")).toHaveAttribute("width", "64");
  await dragTile(page, await mapPoint(page, 4.5, 4.5));
  const panel = selection(page);
  await expect(
    panel.getByRole("heading", { name: "Пол 1", exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".map-selection-preview")).toBeVisible();
  await expect(panel.getByText("LC-007", { exact: true })).toBeVisible();
  await expect(panel.locator("dl dd")).toHaveText(["4", "4", "0", "0°"]);
  const box = await panel.boundingBox(),
    canvas = await page.locator(".map-canvas").boundingBox();
  expect(box.height).toBeLessThan(canvas.height);
  expect(box.x + box.width).toBeCloseTo(canvas.x + canvas.width - 12, 0);
  await page.getByRole("button", { name: "Объекты", exact: true }).click();
  await page
    .getByRole("button", { name: "Сундук", exact: true })
    .press("Enter");
  const point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await expect(
    panel.getByRole("heading", { name: "Сундук", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("MA-DungeonChest", { exact: true }),
  ).toBeVisible();
});
test("mixed area selection groups repeated models, assigns them to another area and deletes them", async ({
  page,
}) => {
  await ready(page, "&areaExample&twoAreaObjects");
  await page.getByRole("button", { name: "Области", exact: true }).click();
  await page
    .getByRole("button", { name: "Выбрать все объекты в области", exact: true })
    .click();
  const panel = selection(page);
  await expect(panel.locator(".map-entity-row")).toHaveCount(2);
  await expect(panel.locator(".map-entity-count")).toHaveText(["×2", "×2"]);
  await panel
    .getByRole("button", { name: "Добавить в область", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Создать область", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.areas.length))
    .toBe(2);
  const area = await page.evaluate(() => window.lastSaved.document.areas[1]);
  expect(area.tileIds).toHaveLength(2);
  expect(area.objectIds).toHaveLength(2);
  await panel
    .getByRole("button", { name: "Удалить выбранное", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.tiles.length))
    .toBe(0);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.objects.length))
    .toBe(0);
  await expect(panel).toHaveCount(0);
});
test("light rows toggle by icon, show their area, and anchor picking focuses the linked model", async ({
  page,
}) => {
  await ready(page, "&lightExample&shaped&lit");
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  const lights = page.getByRole("region", {
    name: "Освещение карты",
    exact: true,
  });
  await expect(
    lights.getByText("Выберите пресет через плюс", { exact: false }),
  ).toHaveCount(0);
  await expect(lights.getByLabel("Название источника света")).toHaveCount(0);
  await lights.getByRole("button", { name: "Факел", exact: true }).click();
  const panel = selection(page);
  await expect(panel.getByLabel("Название источника света")).toBeVisible();
  await lights
    .getByRole("button", { name: "Выключить Факел", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.lights[0].enabled),
    )
    .toBe(false);
  await expect(
    lights.getByRole("button", { name: "Включить Факел", exact: true }),
  ).toBeVisible();
  await lights
    .getByRole("button", { name: "Включить Факел", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Добавить в область", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Создать область", exact: true })
    .click();
  await expect(
    lights.getByText("Факел (Область 1)", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Привязать", exact: true }).click();
  await expect(panel.getByRole("status")).toHaveText(
    "Нажмите на плитку или объект на карте.",
  );
  const point = await mapPoint(page, 4.2, 4.2);
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.lights[0].anchor?.kind),
    )
    .toBe("tile");
  await panel.getByRole("button", { name: "Пол 1", exact: true }).click();
  await expect(
    panel.getByRole("heading", { name: "Пол 1", exact: true }),
  ).toBeVisible();
});
test("autosave only opens an error popup on failure and records the last successful date in settings", async ({
  page,
}) => {
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Сохранить", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.evaluate(() => {
    window.failNextSave = 500;
  });
  await page
    .getByLabel("Название карты", { exact: true })
    .fill("Проверка автосохранения");
  await page.getByLabel("Название карты", { exact: true }).blur();
  const error = page.getByRole("dialog", {
    name: "Не удалось сохранить карту",
    exact: true,
  });
  await expect(error).toBeVisible();
  await expect(error.getByRole("alert")).toContainText("Нет связи");
  await error
    .getByRole("button", { name: "Повторить сохранение", exact: true })
    .click();
  await expect(error).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.name))
    .toBe("Проверка автосохранения");
  await expect(
    page.getByLabel("Последнее сохранение", { exact: true }).locator("time"),
  ).toHaveAttribute(
    "datetime",
    await page.evaluate(() => window.lastSaved.changedAt),
  );
});
