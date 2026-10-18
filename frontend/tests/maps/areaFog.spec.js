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

  await expect(
    focus.getByRole("button", { name: "Снять фокус области", exact: true }),
  ).toHaveCount(0);
  const frame = await focus.locator(".map-selected-frame").boundingBox(),
    trash = await focus
      .getByRole("button", { name: "Удалить область «Зал»", exact: true })
      .boundingBox();
  expect(trash.x).toBeGreaterThanOrEqual(frame.x + frame.width);
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
    .getByRole("button", { name: "Изменить название области", exact: true })
    .click();
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
