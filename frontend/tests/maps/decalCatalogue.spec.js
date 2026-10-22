import { expect, test } from "@playwright/test";
import { dragDecal, mapPoint } from "./editorHelpers";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=",
  "base64",
);
async function cardStyle(card) {
  return card.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      padding: style.padding,
      borderRadius: style.borderRadius,
      imageHeight: getComputedStyle(element.querySelector("img")).height,
    };
  });
}
test("catalogue cards share their appearance; decals drag, cancel and upload only to custom", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor&lightExample");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const tileStyle = await cardStyle(
    page.getByRole("button", { name: "Пол с декором", exact: true }),
  );
  await page.getByRole("button", { name: "Объекты", exact: true }).click();
  expect(
    await cardStyle(page.getByRole("button", { name: "Сундук", exact: true })),
  ).toEqual(tileStyle);
  await page.getByRole("button", { name: "Декали", exact: true }).click();
  const palette = page.getByRole("region", {
      name: "Каталог декалей",
      exact: true,
    }),
    card = palette.getByRole("button", { name: "Лужа крови", exact: true });
  expect(await cardStyle(card)).toEqual(tileStyle);
  await expect(palette.getByRole("combobox")).toHaveCount(0);
  const p = await mapPoint(page, 4.5, 4.5);
  const b = await card.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + 30);
  await page.mouse.move(p.x, p.y);
  await expect(page.locator(".map-canvas--draw")).toHaveCount(0);
  expect(
    await page.evaluate(() => window.lastSaved?.document.decals),
  ).toBeUndefined();
  await page.mouse.move(b.x + b.width / 2, b.y + 30);
  await page.mouse.down();
  await page.mouse.move(p.x, p.y, { steps: 6 });
  await expect(page.locator(".map-canvas--draw")).toBeVisible();
  expect(
    await page.evaluate(() => window.lastSaved?.document.decals),
  ).toBeUndefined();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".map-canvas--draw")).toHaveCount(0);
  await dragDecal(page, "Лужа крови", p);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.decals?.length))
    .toBe(1);
  await expect(
    palette.getByRole("region", { name: "На карте", exact: true }),
  ).toHaveCount(0);
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "Мой плакат.png",
      mimeType: "image/png",
      buffer: png,
    });
  const custom = palette.getByRole("region", { name: "Свои", exact: true });
  await expect(
    custom.getByRole("button", { name: "Мой плакат", exact: true }),
  ).toBeVisible();
  await expect(
    palette
      .getByRole("region", { name: "Плакаты", exact: true })
      .getByRole("button", { name: "Мой плакат", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".map-canvas--draw")).toHaveCount(0);
  await dragDecal(page, "Мой плакат", p);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.decals?.length))
    .toBe(2);
  expect(
    await page.evaluate(() => window.lastSaved.document.decals[1].category),
  ).toBe("custom");
  expect(errors).toEqual([]);
});
