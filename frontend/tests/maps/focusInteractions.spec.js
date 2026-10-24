import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";
const focus = (page) =>
  page.getByRole("complementary", { name: "Выбранные элементы", exact: true });
async function ready(page, extra = "", mode = "editor") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=${mode}${extra}`);
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
async function redPixels(page) {
  const png = await page.locator(".map-canvas canvas").screenshot();
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
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] > 190 && pixels[i + 1] < 150 && pixels[i + 2] < 160)
        count++;
    return count;
  }, png.toString("base64"));
}
test("invalid clipboard placement outlines geometry red without an alert and remains available at a valid destination", async ({
  page,
}) => {
  await ready(page);
  const occupied = await mapPoint(page, 4.5, 4.5);
  const initial = await page.evaluate(
    () => window.templateMap.document.tiles.length,
  );
  await dragTile(page, occupied);
  const normalRed = await redPixels(page);
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");
  await expect.poll(() => redPixels(page)).toBeGreaterThan(normalRed + 30);
  await page.mouse.click(occupied.x, occupied.y);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(
    await page.evaluate(() => window.lastSaved?.document.tiles.length || 0),
  ).toBeLessThanOrEqual(initial + 1);
  const valid = await mapPoint(page, 6.5, 4.5);
  await page.mouse.move(valid.x, valid.y, { steps: 10 });
  await expect.poll(() => redPixels(page)).toBeLessThan(normalRed + 10);
  await page.mouse.click(valid.x, valid.y);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.tiles.length))
    .toBe(initial + 2);
  await page.keyboard.press("Escape");
  await expect(focus(page)).toHaveCount(0);
});
test("focused area gives both models its chosen contour colour and the eye in its left row never changes focus", async ({
  page,
}) => {
  await ready(page, "&areaExample");
  await page.getByRole("button", { name: "Области", exact: true }).click();
  const list = page.getByRole("region", { name: "Области карты" });
  await list.getByRole("button", { name: "Зал", exact: true }).click();
  await focus(page)
    .getByRole("button", { name: "Цвет области", exact: true })
    .click();
  await page.getByRole("button", { name: "#ef4444", exact: true }).click();
  await expect.poll(() => redPixels(page)).toBeGreaterThan(30);
  const eye = list.getByRole("button", {
    name: "Скрыть область «Зал»",
    exact: true,
  });
  await eye.click();
  await expect(
    focus(page).getByRole("heading", { name: "Зал", exact: true }),
  ).toBeVisible();
  await expect(
    list.getByRole("button", { name: "Показать область «Зал»", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
test("Escape dismisses object and light focus even from text fields and a session creature focus", async ({
  page,
}) => {
  await ready(page, "&areaExample&attachmentExample");
  await page.getByRole("button", { name: "Области", exact: true }).click();
  await page
    .getByRole("region", { name: "Области карты" })
    .getByRole("button", { name: "Зал", exact: true })
    .click();
  await focus(page)
    .getByRole("button", { name: "Сундук", exact: true })
    .click();
  await expect(
    focus(page).getByRole("heading", { name: "Сундук", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(focus(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  await page
    .getByRole("region", { name: "Освещение карты" })
    .locator(".map-entity-row")
    .first()
    .click();
  await focus(page)
    .getByRole("button", {
      name: "Изменить название источника света",
      exact: true,
    })
    .click();
  await focus(page).getByRole("textbox").first().focus();
  await page.keyboard.press("Escape");
  await expect(focus(page)).toHaveCount(0);
  await ready(page, "&creatures", "board");
  await page.getByRole("button", { name: "Существа", exact: true }).click();
  await page.getByRole("button", { name: "Лира", exact: true }).press("Enter");
    await page.getByRole("menuitem", { name: "Выбрать на карте", exact: true }).click();
  await expect(
    focus(page).getByRole("heading", { name: "Лира", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(focus(page)).toHaveCount(0);
});
