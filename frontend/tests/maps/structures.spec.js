import { test, expect } from "@playwright/test";
import { dragTile, mapPoint, choosePack } from "./editorHelpers";
async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
test("collection filters and selecting a side wall without layout controls", async ({
  page,
}) => {
  await ready(page);
  await choosePack(page, "ultimate-dungeon");
  await expect(
    page.getByRole("button", { name: "Стена 1", exact: true }),
  ).toHaveCount(0);
  await dragTile(page, await mapPoint(page, 4.5, 4.5), {
    name: "Боковая стена",
  });
  await expect(page.locator(".map-selected-heading h3")).toHaveText(
    "Боковая стена",
  );
  await expect(page.locator(".map-tile-connections")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Сторона:/ })).toHaveCount(0);
});
test("a frame supports upper tiles, carries them and deletes the dependent stack", async ({
  page,
}) => {
  await ready(page);
  await choosePack(page, "ultimate-dungeon");
  await dragTile(page, await mapPoint(page, 5, 4.5), { name: "Каркас 2×1" });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) =>
            t.modelId.startsWith("7777"),
          )?.x,
      ),
    )
    .toBe(4);
  await expect(page.getByLabel("Уровень размещения")).toHaveCount(0);
  await dragTile(page, await mapPoint(page, 4.5, 4.5), {
    name: "Каменный пол",
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) =>
            t.modelId.startsWith("8888"),
          )?.level,
      ),
    )
    .toBe(1);
  const empty = await mapPoint(page, 8.1, 5.1);
  await page.mouse.click(empty.x, empty.y);
  const start = await mapPoint(page, 4.02, 4.5),
    end = await mapPoint(page, 6.02, 4.5);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) =>
            t.modelId.startsWith("7777"),
          )?.x,
      ),
    )
    .toBe(6);
  expect(
    await page.evaluate(
      () =>
        window.lastSaved.document.tiles.find((t) =>
          t.modelId.startsWith("8888"),
        ).x,
    ),
  ).toBe(6);
  await page
    .getByRole("button", { name: "Удалить плитки", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.filter(
            (t) => t.modelId.startsWith("7777") || t.modelId.startsWith("8888"),
          ).length,
      ),
    )
    .toBe(0);
});
test("empty-space drag pans the map without changing tiles", async ({
  page,
}) => {
  await ready(page);
  const canvas = page.locator(".map-canvas canvas");
  const before = await canvas.screenshot({ animations: "disabled" });
  const start = await mapPoint(page, 4.5, 4.5),
    end = await mapPoint(page, 5.5, 4.5);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  expect(
    (await canvas.screenshot({ animations: "disabled" })).equals(before),
  ).toBe(false);
  expect(await page.evaluate(() => window.requests)).toEqual([]);
});
test("a three-cell bridge automatically rests on one cell and can rotate above an empty centre", async ({
  page,
}) => {
  await ready(page);
  await choosePack(page, "ultimate-dungeon");
  await dragTile(page, await mapPoint(page, 5, 4.5), { name: "Каркас 2×1" });
  await dragTile(page, await mapPoint(page, 6.5, 4.5), { name: "Мост 3×1" });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.find((t) =>
          t.modelId.startsWith("aaaa"),
        ),
      ),
    )
    .toMatchObject({ x: 5, y: 4, level: 1 });
  await page.getByTitle("Отменить · Ctrl/Cmd+Z").click();
  await dragTile(page, await mapPoint(page, 4.5, 5.5), {
    name: "Мост 3×1",
    rotate: true,
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.find((t) =>
          t.modelId.startsWith("aaaa"),
        ),
      ),
    )
    .toMatchObject({ x: 4, y: 4, level: 1, rotation: 90 });
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("dragging an existing upper tile away from sockets automatically places it on ground", async ({
  page,
}) => {
  await ready(page);
  await choosePack(page, "ultimate-dungeon");
  await dragTile(page, await mapPoint(page, 5, 4.5), { name: "Каркас 2×1" });
  await dragTile(page, await mapPoint(page, 4.5, 4.5), {
    name: "Каменный пол",
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) =>
            t.modelId.startsWith("8888"),
          )?.level,
      ),
    )
    .toBe(1);
  const start = await mapPoint(page, 4.5, 4.5),
    end = await mapPoint(page, 7.5, 5.5);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.find((t) =>
          t.modelId.startsWith("8888"),
        ),
      ),
    )
    .toMatchObject({ x: 7, y: 5, level: 0 });
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("new tiles automatically choose the top socket of a multi-storey frame", async ({
  page,
}) => {
  await ready(page);
  await choosePack(page, "ultimate-dungeon");
  for (let i = 0; i < 2; i++)
    await dragTile(page, await mapPoint(page, 5, 4.5), { name: "Каркас 2×1" });
  await dragTile(page, await mapPoint(page, 4.5, 4.5), {
    name: "Каменный пол",
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) =>
            t.modelId.startsWith("8888"),
          )?.level,
      ),
    )
    .toBe(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
