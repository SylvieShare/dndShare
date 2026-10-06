import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";
async function ready(page, mode = "editor", extra = "") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=${mode}${extra}`);
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  if (mode === "editor")
    await page.getByTitle("Вид сверху", { exact: true }).click();
}
const areas = (page) => page.getByRole("region", { name: "Области карты" });
const open = (page) =>
  page.getByRole("button", { name: "Области", exact: true }).click();
test("named areas contain selected tiles and objects, hide without deleting, and can be removed", async ({
  page,
}) => {
  await ready(page);
  const floor = await mapPoint(page, 4.5, 4.5),
    other = await mapPoint(page, 5.5, 4.5);
  await dragTile(page, floor);
  await dragTile(page, other);
  await page.mouse.click(floor.x, floor.y);
  await open(page);
  await areas(page)
    .getByRole("button", { name: "Создать область", exact: true })
    .click();
  await page.getByLabel("Название области 1", { exact: true }).fill("Зал");
  await page.getByLabel("Название области 1", { exact: true }).press("Enter");
  await areas(page)
    .getByRole("button", { name: "Добавить выбранное (1)", exact: true })
    .click();
  await page.getByRole("button", { name: "Объекты", exact: true }).click();
  await page
    .getByRole("region", { name: "Каталог объектов" })
    .getByRole("button", { name: "Сундук", exact: true })
    .press("Enter");
  await page.mouse.move(other.x, other.y);
  await page.mouse.click(other.x, other.y);
  await open(page);
  await areas(page)
    .getByRole("button", { name: "Добавить выбранное (1)", exact: true })
    .click();
  await expect(
    areas(page).getByText("Тайлов: 1 · Объектов: 1", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("switch", { name: "Скрыть область «Зал»", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.areas[0]?.hidden),
    )
    .toBe(true);
  await page.mouse.move(floor.x, floor.y);
  await expect(page.locator(".map-canvas--hover")).toHaveCount(0);
  expect(
    await page.evaluate(() => window.lastSaved.document.areas[0].name),
  ).toBe("Зал");
  await page
    .getByRole("switch", { name: "Скрыть область «Зал»", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.areas[0]?.hidden),
    )
    .toBe(false);
  await page.mouse.move(floor.x, floor.y);
  await expect(page.locator(".map-canvas--hover")).toBeVisible();
  await areas(page)
    .getByRole("button", { name: "Удалить область «Зал»", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.areas.length))
    .toBe(0);
  expect(
    await page.evaluate(
      () =>
        window.lastSaved.document.tiles.filter(
          (t) => [4, 5].includes(t.x) && t.y === 4,
        ).length,
    ),
  ).toBe(2);
  expect(
    await page.evaluate(
      () => window.lastSaved.document.objects.filter((o) => o.modelId).length,
    ),
  ).toBe(1);
});
test("adding a selected model to another area transfers it and undo restores membership", async ({
  page,
}) => {
  await ready(page);
  await dragTile(page, await mapPoint(page, 4.5, 4.5));
  await open(page);
  const create = areas(page).getByRole("button", {
    name: "Создать область",
    exact: true,
  });
  await create.click();
  await areas(page)
    .getByRole("button", { name: "Добавить выбранное (1)", exact: true })
    .click();
  await create.click();
  await areas(page)
    .getByRole("button", { name: "Добавить выбранное (1)", exact: true })
    .nth(1)
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.areas.map((a) => a.tileIds.length),
      ),
    )
    .toEqual([0, 1]);
  await page.getByTitle("Отменить · Ctrl/Cmd+Z", { exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.areas.map((a) => a.tileIds.length),
      ),
    )
    .toEqual([1, 0]);
});
async function modelPixels(page) {
  const style = await page.addStyleTag({
    content:
      '.map-canvas > :not(.map-canvas-surface), [aria-label="Действия карты"] { visibility: hidden !important; }',
  });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const png = await page.locator(".map-canvas canvas").screenshot();
  await style.evaluate((node) => node.remove());
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
    const p = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let score = 0;
    const background = (20 * canvas.width + 20) * 4;
    for (let y = 20; y < canvas.height - 20; y++)
      for (let x = 20; x < canvas.width - 20; x++) {
        const i = (y * canvas.width + x) * 4;
        score +=
          Math.abs(p[i] - p[background]) +
          Math.abs(p[i + 1] - p[background + 1]) +
          Math.abs(p[i + 2] - p[background + 2]);
      }
    return score;
  }, png.toString("base64"));
}
for (const mode of ["editor", "screen", "board"])
  test(`hidden areas ${mode === "board" ? "remain faintly visible in session" : `disappear in ${mode}`}`, async ({
    page,
  }) => {
    await ready(page, mode, "&areaExample");
    const normal = await modelPixels(page);
    expect(normal).toBeGreaterThan(10000);
    await ready(page, mode, "&areaExample&hiddenArea");
    const hidden = await modelPixels(page);
    if (mode === "board") {
      expect(hidden).toBeGreaterThan(normal * 0.02);
      expect(hidden).toBeLessThan(normal * 0.4);
    } else expect(hidden).toBeLessThan(normal * 0.01);
  });
