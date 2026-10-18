import { test, expect } from "@playwright/test";
for (const mode of ["editor", "board"])
  test(`areas use a single volume fog and preserve the switch in ${mode}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /Shader|WebGL|GL_INVALID/.test(m.text()))
        errors.push(m.text());
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
    const panel = page.getByRole("complementary", {
      name: "Выбранные элементы",
      exact: true,
    });
    await expect(
      panel.getByRole("combobox", { name: "Вариант тумана", exact: true }),
    ).toHaveCount(0);
    await panel
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
    await page.locator(".map-canvas-surface").focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(
      panel.getByRole("button", {
        name: "Покрыть туманом область «Зал»",
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(
      panel.getByRole("button", {
        name: "Убрать туман с области «Зал»",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByTitle("Вид сверху", { exact: true }).click();
    await page
      .locator(".map-canvas canvas")
      .screenshot({ path: `/private/tmp/dndshare-animated-fog-${mode}.png` });
    expect(errors).toEqual([]);
  });
