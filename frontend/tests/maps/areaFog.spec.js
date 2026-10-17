import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";
const panel = (page) =>
  page.getByRole("complementary", { name: "Выбранные элементы", exact: true });
async function ready(page, mode = "editor") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/tests/maps/fixtures/maps.html?mode=${mode}&areaExample&twoAreaObjects&attachmentExample`,
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
async function focusArea(page) {
  await page.getByRole("button", { name: "Области", exact: true }).click();
  await page
    .getByRole("region", { name: "Области карты" })
    .getByRole("button", { name: "Зал", exact: true })
    .click();
}
async function sampleArea(page) {
  const png = await page.locator(".map-canvas canvas").screenshot();
  const canvas = await page.locator(".map-canvas-surface").boundingBox(),
    point = await mapPoint(page, 4.5, 4.5);
  return page.evaluate(
    async ({ data, x, y }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], {
          type: "image/png",
        }),
      );
      const out = new OffscreenCanvas(bitmap.width, bitmap.height),
        ctx = out.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
    },
    {
      data: png.toString("base64"),
      x: point.x - canvas.x,
      y: point.y - canvas.y,
    },
  );
}
test("area focus has an isolated cached preview, icon controls and Cmd membership; Esc also closes it from an input", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Shader|WebGLProgram/.test(msg.text()))
      errors.push(msg.text());
  });
  await ready(page);
  await dragTile(page, await mapPoint(page, 6.5, 4.5));
  await focusArea(page);
  const focus = panel(page);
  await expect(focus.locator(".map-area-preview")).toHaveAttribute(
    "data-preview-state",
    "ready",
  );
  await expect(
    focus.getByRole("button", { name: "Цвет области", exact: true }),
  ).toHaveClass(/cpp-button/);

  const buttons = await focus.locator(".map-area-focus-heading button").all();
  expect(await buttons[0].getAttribute("aria-label")).toBe(
    "Удалить область «Зал»",
  );
  expect(await buttons[1].getAttribute("aria-label")).toBe(
    "Снять фокус области",
  );
  const before = await focus
    .locator(".map-area-preview canvas")
    .evaluate((el) => el.toDataURL());
  await page.keyboard.down("ControlOrMeta");
  const tile = await mapPoint(page, 4.1, 4.1);
  await page.mouse.click(tile.x, tile.y);
  await expect(
    focus.getByRole("heading", { name: "Зал", exact: true }),
  ).toBeVisible();
  const outside = await mapPoint(page, 6.5, 4.5);
  await page.mouse.click(outside.x, outside.y);
  await page.keyboard.up("ControlOrMeta");
  await expect(
    focus.getByRole("heading", { name: "Зал", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.areas[0].tileIds.includes("area-floor"),
      ),
    )
    .toBe(false);
  await expect
    .poll(() =>
      focus
        .locator(".map-area-preview canvas")
        .evaluate((el) => el.toDataURL()),
    )
    .not.toBe(before);
  await focus
    .getByRole("textbox", { name: "Название области", exact: true })
    .focus();
  await page.keyboard.press("Escape");
  await expect(focus).toHaveCount(0);
  expect(errors).toEqual([]);
});
for (const mode of ["editor", "board"])
  test(`area fog persists and restores source preferences in ${mode}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error" && /Shader|WebGLProgram/.test(msg.text()))
        errors.push(msg.text());
    });
    await ready(page, mode);
    await focusArea(page);
    const focus = panel(page);
    await focus
      .getByRole("button", {
        name: "Покрыть туманом область «Зал»",
        exact: true,
      })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window.lastSaved || window.latestBoard)?.document.areas[0].fog,
        ),
      )
      .toBe(true);
    await expect
      .poll(async () => {
        const pixel = await sampleArea(page);
        return pixel[2] > pixel[0] + 2 && pixel[0] > 30;
      })
      .toBe(true);
    await expect(focus.locator(".map-area-preview")).toHaveAttribute(
      "data-preview-state",
      "ready",
    );
    await focus
      .getByRole("button", {
        name: "Убрать туман с области «Зал»",
        exact: true,
      })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window.lastSaved || window.latestBoard)?.document.areas[0].fog,
        ),
      )
      .toBe(false);
    expect(
      await page.evaluate(
        () => (window.lastSaved || window.latestBoard).document.objects.length,
      ),
    ).toBe(2);
    expect(errors).toEqual([]);
  });
