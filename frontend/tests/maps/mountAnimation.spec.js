import { test, expect } from "@playwright/test";
import { dragTile, mapPoint, choosePack } from "./editorHelpers";
async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
  await choosePack(page, "ultimate-dungeon");
}
async function cyan(page, canvas) {
  const png = await canvas.screenshot({ animations: "disabled" });
  return page.evaluate(async (base64) => {
    const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const image = await createImageBitmap(
        new Blob([data], { type: "image/png" }),
      ),
      canvas = new OffscreenCanvas(image.width, image.height),
      ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
    let x = 0,
      y = 0,
      count = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (
        pixels[i + 2] > 120 &&
        pixels[i + 2] > pixels[i] * 1.3 &&
        pixels[i + 1] > pixels[i] * 1.15
      ) {
        x += (i / 4) % image.width;
        y += Math.floor(i / 4 / image.width);
        count++;
      }
    return { x: x / count, y: y / count, count };
  }, png.toString("base64"));
}
test("a moving tile rises above its body datum and smoothly returns after release", async ({
  page,
}) => {
  await ready(page);
  await dragTile(page, await mapPoint(page, 6.5, 5.5), {
    name: "Плитка с выступом",
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) =>
          t.modelId.startsWith("bbbb"),
        ),
      ),
    )
    .toBe(true);
  await page.getByTitle("Изометрический вид", { exact: true }).click();
  const canvas = page.locator(".map-canvas canvas"),
    bounds = await canvas.boundingBox(),
    before = await cyan(page, canvas);
  expect(before.count).toBeGreaterThan(10);
  await page.mouse.move(bounds.x + before.x, bounds.y + before.y);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await expect
    .poll(async () => (await cyan(page, canvas)).y)
    .toBeLessThan(before.y - 4);
  await page.mouse.up();
  await expect
    .poll(async () => Math.abs((await cyan(page, canvas)).y - before.y))
    .toBeLessThan(1.5);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("a tile with a peg is placed on a frame while keeping the body contact level", async ({
  page,
}) => {
  await ready(page);
  await dragTile(page, await mapPoint(page, 5, 4.5), { name: "Каркас 2×1" });
  await dragTile(page, await mapPoint(page, 4.5, 4.5), {
    name: "Плитка с выступом",
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) =>
            t.modelId.startsWith("bbbb"),
          )?.level,
      ),
    )
    .toBe(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
