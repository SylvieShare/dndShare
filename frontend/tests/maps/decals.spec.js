import { expect, test } from "@playwright/test";
import { mapPoint } from "./editorHelpers";

test("decal categories, surface placement, editing, upload and undo", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", message => { if (message.type() === "error" && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor&lightExample");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
  await page.getByRole("button", { name: "Декали", exact: true }).click();
  const category = page.getByRole("combobox", { name: "Категория декалей" });
  await category.selectOption("posters");
  await expect(
    page.getByRole("button", { name: "Разместить: Разыскивается" }),
  ).toBeVisible();
  await category.selectOption("traces");
  await page.getByRole("button", { name: "Разместить: Лужа крови" }).click();
  const p = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(p.x, p.y, { steps: 6 });
  await page.mouse.click(p.x, p.y);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.decals?.length))
    .toBe(1);
  const focus = page.getByRole("complementary", { name: "Выбранные элементы" });
  await expect(
    focus.getByRole("slider", { name: "Ширина", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.lastSaved.document.decals[0]),
  ).toMatchObject({
    anchor: { kind: "tile", id: "light-floor" },
    normal: [0, 1, 0],
  });
  await focus
    .getByRole("slider", { name: "Непрозрачность", exact: true })
    .fill("0.5");
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved.document.decals[0].opacity),
    )
    .toBe(0.5);
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved.document.decals[0].opacity),
    )
    .toBe(1);
  await page.getByRole("button", { name: "Объекты", exact: true }).click();
  await page.mouse.click(p.x, p.y);
  await expect(focus.getByRole("slider", { name: "Непрозрачность", exact: true })).toBeVisible();
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.press("Delete");
  await expect.poll(() => page.evaluate(() => window.lastSaved.document.decals)).toBeUndefined();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => page.evaluate(() => window.lastSaved.document.decals?.length)).toBe(1);
  await page.getByRole("button", { name: "Декали", exact: true }).click();
  await category.selectOption("custom");
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "Своя руна.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(
    page.getByRole("button", { name: "Разместить: Своя руна" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
