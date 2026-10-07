import { test, expect } from "@playwright/test";
import { dragTile, mapPoint, pickTile } from "./editorHelpers";

async function ready(page, shaped = false) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/tests/maps/fixtures/maps.html?mode=editor${shaped ? "&shaped" : ""}`,
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
async function bluePixels(page) {
  const style = await page.addStyleTag({
    content:
      ".map-canvas > :not(.map-canvas-surface) { visibility: hidden !important; }",
  });
  const png = await page.locator(".map-canvas canvas").screenshot();
  await style.evaluate((node) => node.remove());
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: "image/png" }),
    );
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
      ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (
        pixels[i + 2] > 110 &&
        pixels[i + 2] > pixels[i] + 25 &&
        pixels[i + 2] > pixels[i + 1] + 10
      )
        count++;
    return count;
  }, png.toString("base64"));
}

test("editor defaults to selection and exposes icon sections without brush controls", async ({
  page,
}) => {
  await ready(page);
  for (const name of [
    "Выбор",
    "Обзор",
    "Расставлять",
    "Ластик",
    "Заполнить",
    "Повернуть выбранную",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  await expect(page.getByLabel("Поиск плиток", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(0);
  const point = await mapPoint(page, 4.1, 4.1);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(1400);
  expect(await page.evaluate(() => window.requests)).toEqual([]);
});

test("hover outlines actual geometry and selection strengthens it with actions in the toolbar", async ({
  page,
}) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await ready(page, true);
  await page.mouse.move(0, 0);
  const baseline = await bluePixels(page);
  const empty = await mapPoint(page, 1.8, 1.8),
    wall = await mapPoint(page, 1.1, 1.5);
  await page.mouse.move(empty.x, empty.y);
  await expect(page.locator(".map-canvas--hover")).toHaveCount(0);
  await page.mouse.click(empty.x, empty.y);
  await expect(page.getByRole("group", { name: "Стыки стен" })).toHaveCount(0);
  await page.mouse.move(wall.x, wall.y);
  await expect(page.locator(".map-canvas--hover")).toBeVisible();
  const hovered = await bluePixels(page);
  expect(hovered).toBeGreaterThan(baseline + 20);
  await page.mouse.click(wall.x, wall.y);
  await expect(page.getByRole("group", { name: "Стыки стен" })).toHaveCount(0);
  const selected = await bluePixels(page);
  expect(selected).toBeGreaterThan(hovered + 20);
  expect(await page.evaluate(() => window.requests)).toEqual([]);
  const bounds = await page.locator(".map-canvas-surface").boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down({ button: "right" });
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 100,
    bounds.y + bounds.height / 2 - 80,
    { steps: 5 },
  );
  await page.mouse.up({ button: "right" });
  await expect(page.locator(".map-tile-connections")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Удалить плитку", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) => t.x === 1 && t.y === 1),
      ),
    )
    .toBe(false);
  expect(errors.filter((e) => /THREE|WebGL|shader/i.test(e))).toEqual([]);
});

test("dragging can be cancelled or dropped outside without saving a tile", async ({
  page,
}) => {
  await ready(page);
  const point = await mapPoint(page, 4.5, 4.5);
  await pickTile(page);
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await dragTile(page, { x: 10, y: 10 });
  await page.waitForTimeout(1400);
  expect(await page.evaluate(() => window.requests)).toEqual([]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("occupied drops magnetize to a free position and moving a tile is a single undo", async ({
  page,
}) => {
  await ready(page);
  await dragTile(page, await mapPoint(page, 1.5, 1.5));
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.filter((t) =>
            t.modelId.startsWith("2222"),
          ).length,
      ),
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () =>
        window.lastSaved.document.tiles.find((t) => t.x === 1 && t.y === 1)
          .modelId,
    ),
  ).toBe("11111111-1111-4111-8111-111111111111");
  await dragTile(page, await mapPoint(page, 4.5, 4.5));
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) => t.x === 4 && t.y === 4),
      ),
    )
    .toBe(true);
  const original = await mapPoint(page, 4.5, 4.5),
    target = await mapPoint(page, 5.5, 4.5);
  await page.mouse.move(original.x, original.y);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) => t.x === 5 && t.y === 4),
      ),
    )
    .toBe(true);
  await page.getByTitle("Отменить · Ctrl/Cmd+Z").click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) => t.x === 4 && t.y === 4),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(() =>
      window.lastSaved.document.tiles.some((t) => t.x === 5 && t.y === 4),
    ),
  ).toBe(false);
});

test("keyboard placement uses arrows, R and Enter", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Плитки", exact: true }).click();
  await page.getByRole("button", { name: "Пол 1", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(140);
  await page.keyboard.up("ArrowLeft");
  await page.waitForTimeout(180);
  await page.keyboard.press("r");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some(
          (t) => t.x === 5 && t.y === 5 && t.rotation === 90,
        ),
      ),
    )
    .toBe(true);
});

test("sidebar tab rail keeps the native context menu, including during pending tile placement", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    window.railContexts = [];
    window.addEventListener("contextmenu", (event) => {
      if (
        event.target.closest(".map-sidebar-tabs") ||
        document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest(".map-sidebar-tabs")
      )
        window.railContexts.push(event.defaultPrevented);
    });
  });
  const rail = page.locator(".map-sidebar-tabs");
  await rail.click({ button: "right", position: { x: 24, y: 20 } });
  await expect
    .poll(() => page.evaluate(() => window.railContexts))
    .toEqual([false]);
  await pickTile(page, "Пол 1");
  await rail.click({ button: "right", position: { x: 24, y: 20 } });
  await expect
    .poll(() => page.evaluate(() => window.railContexts))
    .toEqual([false, false]);
  const point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.filter((t) =>
            t.modelId.startsWith("2222"),
          ).length,
      ),
    )
    .toBe(1);
  const card = page.getByRole("button", { name: "Пол 1", exact: true });
  const cardBounds = await card.boundingBox();
  const railBounds = await rail.boundingBox();
  await page.mouse.move(cardBounds.x + cardBounds.width / 2, cardBounds.y + 25);
  await page.mouse.down();
  await expect
    .poll(() => card.evaluate((element) => element.hasPointerCapture(1)))
    .toBe(true);
  await page.mouse.move(railBounds.x + 24, railBounds.y + 20, { steps: 5 });
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect
    .poll(() => page.evaluate(() => window.railContexts))
    .toEqual([false, false, false]);
  await page.mouse.up();
});

test("a quick drag over a tile pans the camera while a held drag edits and Escape cancels it", async ({
  page,
}) => {
  await ready(page);
  await dragTile(page, await mapPoint(page, 4.5, 4.5));
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) => t.x === 4 && t.y === 4),
      ),
    )
    .toBe(true);
  const original = await page.evaluate(() =>
    JSON.stringify(window.lastSaved.document),
  );
  const canvas = page.locator(".map-canvas canvas"),
    before = await canvas.screenshot();
  let point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 90, point.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  expect(
    await page.evaluate(() => JSON.stringify(window.lastSaved.document)),
  ).toBe(original);
  await page.getByTitle("Показать всю карту", { exact: true }).click();
  point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await expect(page.locator(".map-controls-hint")).toContainText(
    "разместить плитку",
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(() => JSON.stringify(window.lastSaved.document)),
  ).toBe(original);
});
