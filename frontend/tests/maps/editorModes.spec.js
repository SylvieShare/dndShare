import { test, expect } from "@playwright/test";
import { mapPoint, dragTile, pickTile, choosePack } from "./editorHelpers";
async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
test("shared header, global collection, floating actions and independent visibility settings", async ({
  page,
}) => {
  await ready(page);
  expect(await page.locator(".workspace-header").boundingBox()).toMatchObject({
    height: 64,
  });
  await expect(page.getByLabel("Название карты", { exact: true })).toHaveCount(
    0,
  );
  const canvas = await page.locator(".map-canvas").boundingBox(),
    actions = await page
      .getByRole("toolbar", { name: "Действия карты" })
      .boundingBox();
  expect(canvas).toMatchObject({ x: 334, y: 64, width: 1106, height: 936 });
  await expect(page.locator(".map-inspector")).toHaveCount(0);
  for (const name of ["Карта"]) {
    const tab = page.getByRole("tab", { name, exact: true });
    await expect(tab.locator("svg")).toHaveCount(1);
  }
  for (const name of ["Предметы", "Настройки"])
    await expect(page.getByRole("tab", { name, exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Настройки", exact: true }).locator("svg"),
  ).toHaveCount(1);
  expect(actions.y).toBeGreaterThanOrEqual(canvas.y);
  expect(actions.x).toBeGreaterThan(canvas.x + canvas.width / 2);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByLabel("Название карты", { exact: true })).toHaveValue(
    "Крепость на переправе",
  );
  await expect(
    page
      .getByRole("group", { name: "Ширина карты", exact: true })
      .getByRole("spinbutton"),
  ).toHaveValue("12");
  await expect(
    page
      .getByRole("group", { name: "Высота карты", exact: true })
      .getByRole("spinbutton"),
  ).toHaveValue("10");
  await page.getByLabel("Показывать точки в пазах").click();
  await page.getByLabel("Показывать сетку", { exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.grid.visible))
    .toBe(false);
  await page.getByRole("button", { name: "Плитки", exact: true }).click();
  await choosePack(page, "ultimate-dungeon");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await expect(page.getByLabel("Показывать точки в пазах")).not.toBeChecked();
});
test("ground has no clickable spheres and socket spheres insert floor from the global collection", async ({
  page,
}) => {
  await ready(page);
  await choosePack(page, "ultimate-dungeon");
  const p = await mapPoint(page, 4.5, 4.5);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.requests)).toEqual([]);
  await dragTile(page, await mapPoint(page, 5, 4.5), { name: "Каркас 2×1" });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) =>
          t.modelId.startsWith("7777"),
        ),
      ),
    )
    .toBe(true);
  await page.waitForTimeout(800);
  await page.mouse.click(p.x, p.y);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find(
            (t) => t.x === 4 && t.y === 4 && t.level === 1,
          )?.modelId,
      ),
    )
    .toBe("88888888-8888-4888-8888-888888888888");
});
test("objects from the side palette place a cursor preview on click", async ({
  page,
}) => {
  await ready(page);
  await dragTile(page, await mapPoint(page, 4.5, 4.5));
  await page.getByRole("button", { name: "Объекты", exact: true }).click();
  await page
    .getByRole("button", { name: "Сундук", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("tab", { name: "Карта", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const p = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.objects.some(
          (o) => o.kind === "chest" && o.x === 4.5 && o.y === 4.5,
        ),
      ),
    )
    .toBe(true);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("copy only stores a snapshot and repeated paste creates independent copies", async ({
  page,
}) => {
  await ready(page);
  const p = await mapPoint(page, 3.5, 3.5);
  await dragTile(page, p);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) => t.x === 3 && t.y === 3),
      ),
    )
    .toBe(true);
  const count = await page.evaluate(
    () => window.lastSaved.document.tiles.length,
  );
  await page.keyboard.press("Control+c");
  expect(
    await page.evaluate(() => window.lastSaved.document.tiles.length),
  ).toBe(count);
  for (const x of [5.5, 7.5]) {
    await page.keyboard.press("Control+v");
    const q = await mapPoint(page, x, 4.5);
    await page.mouse.move(q.x, q.y);
    await page.mouse.click(q.x, q.y);
    await expect
      .poll(() => page.evaluate(() => window.lastSaved?.document.tiles.length))
      .toBe(count + (x === 5.5 ? 1 : 2));
  }
  const ids = await page.evaluate(() =>
    window.lastSaved.document.tiles
      .filter((t) => t.y === 4 && [5, 7].includes(t.x))
      .map((t) => t.id),
  );
  expect(new Set(ids).size).toBe(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("moving tiles load full render geometry while the wide map uses LOD", async ({
  page,
}) => {
  await ready(page);
  await choosePack(page, "ultimate-dungeon");
  for (let i = 0; i < 3; i++)
    await page.getByTitle("Уменьшить", { exact: true }).click();
  await pickTile(page, "Каменный пол");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.loadedModels
          .filter((url) => url.includes("88888888-8888-4888-8888-888888888888"))
          .sort(),
      ),
    )
    .toEqual(["/api/maps/models/88888888-8888-4888-8888-888888888888/render"]);
  expect(await page.evaluate(() => window.requests)).toEqual([]);
  await page.keyboard.press("Escape");
});
