import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";
async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
async function clickWithoutMoving(page) {
  await page.mouse.down();
  await page.mouse.up();
}
test("paste starts at the current cursor without mouse motion and both cancellation paths retain the buffer", async ({
  page,
}) => {
  await ready(page);
  await dragTile(page, await mapPoint(page, 3.5, 3.5));
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) => t.x === 3 && t.y === 3),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Control+c");
  const p = await mapPoint(page, 6.5, 4.5);
  await page.mouse.move(p.x, p.y);
  for (const cancel of ["Escape", "right"]) {
    await page.keyboard.press("Control+v");
    await expect(page.getByRole("group", { name: "Стыки стен" })).toHaveCount(
      0,
    );
    if (cancel === "right") {
      await page.mouse.down({ button: "right" });
      await page.mouse.up({ button: "right" });
    } else await page.keyboard.press(cancel);
    await expect(page.locator(".map-controls-hint")).not.toContainText(
      "вставить участок",
    );
  }
  await page.keyboard.press("Control+v");
  await clickWithoutMoving(page);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles
          .filter((t) => t.modelId.startsWith("2222"))
          .map((t) => [t.x, t.y])
          .sort(),
      ),
    )
    .toEqual([
      [3, 3],
      [6, 4],
    ]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("a copied tile pastes directly into a frame socket without pointer movement after Ctrl+V", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Коллекция плиток").selectOption("ultimate-dungeon");
  await dragTile(page, await mapPoint(page, 5, 4.5), { name: "Каркас 2×1" });
  await dragTile(page, await mapPoint(page, 2.5, 3.5), {
    name: "Каменный пол",
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) => t.x === 2 && t.y === 3),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Control+c");
  const p = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(p.x, p.y);
  await page.keyboard.press("Control+v");
  await clickWithoutMoving(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find(
            (t) => t.modelId.startsWith("8888") && t.x === 4 && t.y === 4,
          )?.level,
      ),
    )
    .toBe(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a copied group uses its actual supports when the cursor is over the gap between them", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Коллекция плиток").selectOption("ultimate-dungeon");
  for (const x of [5, 9])
    await dragTile(page, await mapPoint(page, x, 4.5), { name: "Каркас 2×1" });
  for (const x of [2.5, 6.5])
    await dragTile(page, await mapPoint(page, x, 3.5), {
      name: "Каменный пол",
    });
  const first = await mapPoint(page, 2.5, 3.5);
  await page.keyboard.down("Meta");
  await page.mouse.click(first.x, first.y);
  await page.keyboard.up("Meta");
  await expect(page.getByRole("status", { name: "Выбрано плиток" })).toHaveText(
    "Выбрано: 2",
  );
  await page.keyboard.press("Control+c");
  const target = await mapPoint(page, 6.5, 4.5);
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press("Control+v");
  await clickWithoutMoving(page);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles
          .filter((t) => t.modelId.startsWith("8888") && t.level === 1)
          .map((t) => [t.x, t.y])
          .sort(),
      ),
    )
    .toEqual([
      [4, 4],
      [8, 4],
    ]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
