import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";

async function pixels(page, png, rectangle) {
  return page.evaluate(
    async ({ base64, rectangle }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const image = await createImageBitmap(
        new Blob([bytes], { type: "image/png" }),
      );
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const { x, y, width, height } = rectangle;
      return [...context.getImageData(x, y, width, height).data];
    },
    { base64: png.toString("base64"), rectangle },
  );
}

test("grid lines remain visible in empty space and are occluded by model geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
  await page.getByLabel("Коллекция плиток").selectOption("ultimate-dungeon");
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
  await page.getByRole("tab", { name: "Свойства карты", exact: true }).click();
  const canvas = page.locator(".map-canvas canvas"),
    bounds = await canvas.boundingBox();
  const inside = await mapPoint(page, 5, 4.5),
    outside = await mapPoint(page, 5, 3.5);
  const patch = (p) => ({
    x: Math.round(p.x - bounds.x) - 1,
    y: Math.round(p.y - bounds.y) - 8,
    width: 3,
    height: 16,
  });
  const withGrid = await canvas.screenshot({ animations: "disabled" });
  await page.getByLabel("Показывать сетку", { exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.grid.visible))
    .toBe(false);
  const withoutGrid = await canvas.screenshot({ animations: "disabled" });
  expect(await pixels(page, withGrid, patch(inside))).toEqual(
    await pixels(page, withoutGrid, patch(inside)),
  );
  expect(await pixels(page, withGrid, patch(outside))).not.toEqual(
    await pixels(page, withoutGrid, patch(outside)),
  );
});
