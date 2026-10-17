import { test, expect } from "@playwright/test";
const panel = (page) =>
  page.getByRole("complementary", { name: "Выбранные элементы", exact: true });
async function ready(page, mode = "editor") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Shader|WebGL|GL_INVALID/.test(msg.text()))
      errors.push(msg.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/tests/maps/fixtures/maps.html?mode=${mode}&areaExample&twoAreaObjects&attachmentExample`,
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByRole("button", { name: "Области", exact: true }).click();
  await page
    .getByRole("region", { name: "Области карты" })
    .getByRole("button", { name: "Зал", exact: true })
    .click();
  await panel(page)
    .getByRole("button", { name: "Покрыть туманом область «Зал»", exact: true })
    .click();
  return errors;
}
for (const mode of ["editor", "board"])
  test(`volume fog V2 renders, persists and switches back to V1 in ${mode}`, async ({
    page,
  }) => {
    const errors = await ready(page, mode),
      select = panel(page).getByRole("combobox", {
        name: "Вариант тумана",
        exact: true,
      });
    await expect(select).toHaveValue("surface");
    await select.selectOption("volume");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window.lastSaved || window.latestBoard)?.document.areas[0]
              .fogStyle,
        ),
      )
      .toBe("volume");
    await page
      .locator(".map-canvas canvas")
      .screenshot({ path: `/private/tmp/dndshare-volume-${mode}.png` });
    expect(errors).toEqual([]);
    await page.locator(".map-canvas-surface").focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(select).toHaveValue("surface");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(select).toHaveValue("volume");
    expect(
      await page.evaluate(() => window.templateMap.document.areas[0].fogStyle),
    ).toBeUndefined();
    await page.getByTitle("Вид сверху", { exact: true }).click();
    await page
      .locator(".map-canvas canvas")
      .screenshot({ path: `/private/tmp/dndshare-volume-${mode}-top.png` });
    expect(errors).toEqual([]);
    await select.selectOption("surface");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window.lastSaved || window.latestBoard)?.document.areas[0]
              .fogStyle,
        ),
      )
      .toBe("surface");
    await panel(page)
      .getByRole("button", {
        name: "Убрать туман с области «Зал»",
        exact: true,
      })
      .click();
    await expect(select).toHaveCount(0);
    expect(errors).toEqual([]);
  });
