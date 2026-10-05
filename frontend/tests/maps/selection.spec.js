import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";

async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
async function clickPoint(page, x, y, command = false) {
  const point = await mapPoint(page, x, y);
  if (command) await page.keyboard.down("Meta");
  await page.mouse.click(point.x, point.y);
  if (command) await page.keyboard.up("Meta");
}
const count = (page) => page.getByRole("status", { name: "Выбрано плиток" });

test("command clicks select a group that can be moved, rotated and deleted", async ({
  page,
}) => {
  await ready(page);
  await dragTile(page, await mapPoint(page, 4.5, 4.5));
  await dragTile(page, await mapPoint(page, 6.5, 4.5));
  await clickPoint(page, 4.5, 4.5, true);
  await expect(count(page)).toHaveText("Выбрано: 2");
  await expect(page.getByRole("group", { name: "Стыки стен" })).toHaveCount(0);
  await clickPoint(page, 4.5, 4.5, true);
  await expect(count(page)).toHaveText("Выбрано: 1");
  await clickPoint(page, 4.5, 4.5, true);
  await expect(count(page)).toHaveText("Выбрано: 2");
  const start = await mapPoint(page, 4.5, 4.5),
    end = await mapPoint(page, 5.5, 6.5);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.filter(
            (t) => [5, 7].includes(t.x) && t.y === 6,
          ).length,
      ),
    )
    .toBe(2);
  await page.getByTitle("Отменить · Ctrl/Cmd+Z").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.filter(
            (t) => [4, 6].includes(t.x) && t.y === 4,
          ).length,
      ),
    )
    .toBe(2);
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.press("r");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.filter(
            (t) => [4, 6].includes(t.x) && t.y === 4 && t.rotation === 90,
          ).length,
      ),
    )
    .toBe(2);
  await page
    .getByRole("button", { name: "Удалить плитки", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.filter(
            (t) => [4, 6].includes(t.x) && t.y === 4,
          ).length,
      ),
    )
    .toBe(0);
});

test("command rectangle selects tiles in screen space without moving them", async ({
  page,
}) => {
  await ready(page);
  await dragTile(page, await mapPoint(page, 4.5, 4.5));
  await dragTile(page, await mapPoint(page, 6.5, 4.5));
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.filter(
            (t) => [4, 6].includes(t.x) && t.y === 4,
          ).length,
      ),
    )
    .toBe(2);
  await clickPoint(page, 3.1, 3.1);
  const start = await mapPoint(page, 3.8, 3.8),
    end = await mapPoint(page, 6.9, 4.9);
  await page.keyboard.down("Meta");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await expect(page.locator(".map-selection-marquee")).toBeVisible();
  await page.mouse.up();
  await page.keyboard.up("Meta");
  await expect(count(page)).toHaveText("Выбрано: 2");
  await expect(page.locator(".map-selection-marquee")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Удалить плитки", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.filter(
            (t) => [4, 6].includes(t.x) && t.y === 4,
          ).length,
      ),
    )
    .toBe(0);
});

test("eight connection points retain the last supported model after an invalid attempt", async ({
  page,
}) => {
  await ready(page);
  await dragTile(page, await mapPoint(page, 4.5, 4.5));
  const group = page.getByRole("group", { name: "Стыки стен" });
  await expect(group.getByRole("button")).toHaveCount(8);
  await page.getByRole("button", { name: "Стык: Север", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) => t.x === 4 && t.y === 4)
            ?.modelId,
      ),
    )
    .toBe("66666666-6666-4666-8666-666666666666");
  await page.getByRole("button", { name: "Стык: Восток", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) => t.x === 4 && t.y === 4)
            ?.modelId,
      ),
    )
    .toBe("33333333-3333-4333-8333-333333333333");
  await page
    .getByRole("button", { name: "Стык: Северо-восток", exact: true })
    .click();
  await expect(page.locator(".map-tile-connections--invalid")).toBeVisible();
  await expect(page.getByText("Нет подходящей модели")).toBeVisible();
  await clickPoint(page, 2.1, 4.1);
  await expect(group).toHaveCount(0);
  await clickPoint(page, 4.5, 4.5);
  await expect(group).toBeVisible();
  await expect(page.locator(".map-tile-connections--invalid")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Стык: Север", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Стык: Восток", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Стык: Северо-восток", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("arrow keys move the camera and leave text field navigation alone", async ({
  page,
}) => {
  await ready(page);
  const canvas = page.locator(".map-canvas canvas");
  const before = await canvas.screenshot({ animations: 'disabled' });
  await page.keyboard.press("ArrowRight");
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  await page.getByRole("tab", { name: "Свойства карты", exact: true }).click();
  const after = await canvas.screenshot({ animations: 'disabled' });
  await page.getByLabel("Название карты", { exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  expect((await canvas.screenshot({ animations: 'disabled' })).equals(after)).toBe(true);
  expect(await page.evaluate(() => window.requests)).toEqual([]);
});
