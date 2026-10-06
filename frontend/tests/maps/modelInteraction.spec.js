import { test, expect } from "@playwright/test";
import { dragTile, mapPoint, pickTile } from "./editorHelpers";
async function ready(page, query = "") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=editor${query}`);
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
async function pixels(page, colour) {
  const png = await page.locator(".map-canvas canvas").screenshot();
  return page.evaluate(
    async ({ base64, colour }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
          type: "image/png",
        }),
      );
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
        ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = data.slice(i, i + 3);
        if (
          colour === "green"
            ? g > r + 25 && g > b + 15 && g > 100
            : r > g + 25 && b > g + 40 && b > 110
        )
          count++;
      }
      return count;
    },
    { base64: png.toString("base64"), colour },
  );
}
test("decor toggle offers exactly undecorated or decorated tiles", async ({
  page,
}) => {
  await ready(page);
  const toggle = page.getByRole("radiogroup", { name: "Декор тайлов" });
  await expect(
    toggle.getByRole("radio", { name: "Без декора", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("button", { name: "Пол с декором", exact: true }),
  ).toHaveCount(0);
  await toggle.getByRole("radio", { name: "С декором", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Пол с декором", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Пол 1", exact: true }),
  ).toHaveCount(0);
  await toggle.getByRole("radio", { name: "Без декора", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Пол 1", exact: true }),
  ).toBeVisible();
});
test("an object can be dragged from the rail, shows a loading footprint, rotates and outlines green on hover", async ({
  page,
}) => {
  await ready(page, "&slowModel=ffffffff");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const point = await mapPoint(page, 4.5, 4.5);
  await dragTile(page, point);
  await page.getByRole("button", { name: "Объекты", exact: true }).click();
  const card = page
    .getByRole("region", { name: "Каталог объектов" })
    .getByRole("button", { name: "Сундук", exact: true });
  await card.hover();
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await expect(
    page.getByText("Загружаем модель…", { exact: true }),
  ).toBeVisible();
  expect(await pixels(page, "purple")).toBeGreaterThan(100);
  await page.keyboard.press("r");
  await page.evaluate(() => window.releaseModelLoads());
  await expect(
    page.getByText("Загружаем модель…", { exact: true }),
  ).toHaveCount(0);
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.objects.find((o) => o.modelId)?.rotation,
      ),
    )
    .toBe(90);
  const empty = await mapPoint(page, 8.5, 8.5);
  await page.mouse.click(empty.x, empty.y);
  await page.mouse.move(0, 0);
  const baseline = await pixels(page, "green");
  await page.mouse.move(point.x, point.y);
  await expect(page.locator(".map-canvas--hover")).toBeVisible();
  const hover = await pixels(page, "green");
  expect(hover).toBeGreaterThan(baseline + 20);
  await page.mouse.click(point.x, point.y);
  expect(await pixels(page, "green")).toBeGreaterThan(hover + 20);
  await page.keyboard.press("r");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.objects.find((o) => o.modelId)?.rotation,
      ),
    )
    .toBe(180);
  expect(errors).toEqual([]);
});
test("a delayed tile follows the cursor as a loading footprint and cancels before loading", async ({
  page,
}) => {
  await ready(page, "&slowModel=33333333");
  await pickTile(page, "Угол стены");
  const point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(point.x, point.y);
  await expect(
    page.getByText("Загружаем модель…", { exact: true }),
  ).toBeVisible();
  expect(await pixels(page, "purple")).toBeGreaterThan(100);
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("Загружаем модель…", { exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => window.releaseModelLoads());
  expect(
    await page.evaluate(() =>
      window.latestBoard.document.tiles.some((t) =>
        t.modelId.startsWith("3333"),
      ),
    ),
  ).toBe(false);
});

test("Escape and right click cancel object dragging without placing a copy", async ({
  page,
}) => {
  await ready(page);
  const point = await mapPoint(page, 4.5, 4.5);
  await dragTile(page, point);
  await page.getByRole("button", { name: "Объекты", exact: true }).click();
  const card = page
    .getByRole("region", { name: "Каталог объектов" })
    .getByRole("button", { name: "Сундук", exact: true });
  for (const method of ["escape", "right"]) {
    await card.hover();
    await page.mouse.down();
    await page.mouse.move(point.x, point.y, { steps: 6 });
    if (method === "escape") await page.keyboard.press("Escape");
    else await page.mouse.click(point.x, point.y, { button: "right" });
    await page.mouse.up();
    await expect(
      page.getByText("Загружаем модель…", { exact: true }),
    ).toHaveCount(0);
  }
  await page.waitForTimeout(1400);
  expect(
    await page.evaluate(() =>
      (window.lastSaved || window.latestBoard).document.objects.filter(
        (o) => o.modelId,
      ),
    ),
  ).toEqual([]);
});
