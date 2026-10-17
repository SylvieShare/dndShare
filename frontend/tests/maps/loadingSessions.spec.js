import { test, expect } from "@playwright/test";
import { mapPoint, pickTile } from "./editorHelpers";
async function pixels(page, kind) {
  const png = await page.locator(".map-canvas canvas").screenshot();
  return page.evaluate(
    async ({ base64, kind }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
          type: "image/png",
        }),
      );
      const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext(
        "2d",
      );
      ctx.drawImage(bitmap, 0, 0);
      // Inspect the unobstructed scene; element screenshots also contain floating HTML panels.
      const data = ctx.getImageData(
        0,
        0,
        bitmap.width - 320,
        bitmap.height - 260,
      ).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        if (
          kind === "purple"
            ? b > 90 && b > r * 1.15 && r > g * 1.2
            : r > 30 && g > 30 && b < 90
        )
          count++;
      }
      return count;
    },
    { base64: png.toString("base64"), kind },
  );
}
test("the grid appears while catalogue metadata is still blocked, without a preparation rectangle", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor&slowCatalogue");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Загружаем плитки…")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await expect(page.locator(".map-canvas-message")).toHaveCount(0);
  await expect.poll(() => pixels(page, "grid")).toBeGreaterThan(100);
  await page.evaluate(() => window.releaseCatalogue());
  await expect(page.getByText("Загружаем плитки…")).toHaveCount(0);
});
test("new download batches omit old completions, a dropped object stays visible, and its LOD replaces the placeholder", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor&downloadExample");
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const manager = page.getByRole("region", {
    name: "Загрузка моделей",
    exact: true,
  });
  await expect(manager).toBeVisible();
  await page.evaluate(() => window.finishModelTransfers());
  await expect(manager).toHaveCount(0);
  await expect.poll(() => pixels(page, "purple")).toBe(0);
  await page.evaluate(() => window.pauseModelTransfers());
  await page.getByRole("button", { name: "Объекты", exact: true }).click();
  await page
    .getByRole("button", { name: "Сундук", exact: true })
    .press("Enter");
  await expect(manager).toBeVisible();
  await expect(manager.locator(".map-download-heading > span")).toHaveText(
    "0/2",
  );
  await expect(manager.getByText("LOD", { exact: true })).toHaveCount(0);
  const point = await mapPoint(page, 3.5, 3.5);
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.objects.filter(
            (o) => o.modelId === "ffffffff-ffff-4fff-8fff-ffffffffffff",
          ).length,
      ),
    )
    .toBe(1);
  await expect.poll(() => pixels(page, "purple")).toBeGreaterThan(60);
  const chest = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  await expect
    .poll(() =>
      page.evaluate(
        (chest) =>
          window.modelTransfers.some(
            (url) => url.includes(chest) && url.endsWith("/lod"),
          ),
        chest,
      ),
    )
    .toBe(true);
  await page.evaluate(
    (chest) => window.finishModelTransfer(`${chest}/lod`),
    chest,
  );
  await expect.poll(() => pixels(page, "purple")).toBe(0);
  await expect(manager).toBeVisible();
  await expect(manager.getByText("LOD", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const memory = page.getByRole("region", {
    name: "Кеш моделей карты",
    exact: true,
  });
  await expect(memory).toBeVisible();
  await expect(memory.getByText("Геометрия", { exact: true })).toBeVisible();
  expect(await memory.locator(".map-memory-total strong").innerText()).not.toBe(
    "0 Б",
  );
  await page.evaluate(() => window.finishModelTransfers());
  await expect(manager).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a tile released before any GLB arrives keeps its footprint and upgrades in place", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor&downloadExample");
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const manager = page.getByRole("region", {
    name: "Загрузка моделей",
    exact: true,
  });
  await expect(manager).toBeVisible();
  await page.evaluate(() => window.finishModelTransfers());
  await expect(manager).toHaveCount(0);
  await page.evaluate(() => window.pauseModelTransfers());
  await pickTile(page, "Х-образная стена");
  const p = await mapPoint(page, 4.5, 5.5);
  await page.mouse.move(p.x, p.y, { steps: 10 });
  await page.mouse.click(p.x, p.y);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some(
          (t) => t.modelId.startsWith("5555") && t.x === 4 && t.y === 5,
        ),
      ),
    )
    .toBe(true);
  await expect.poll(() => pixels(page, "purple")).toBeGreaterThan(100);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.modelTransfers.some(
          (url) => url.includes("5555") && url.endsWith("/lod"),
        ),
      ),
    )
    .toBe(true);
  await page.evaluate(() =>
    window.finishModelTransfer("55555555-5555-4555-8555-555555555555/lod"),
  );
  await expect.poll(() => pixels(page, "purple")).toBe(0);
  await expect(manager).toBeVisible();
  await page.evaluate(() => window.finishModelTransfers());
  await expect(manager).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
