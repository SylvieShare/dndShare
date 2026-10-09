import { test, expect } from "@playwright/test";
async function ready(page, options = "") {
  await page.goto(`/tests/maps/fixtures/maps.html?mode=board&${options}`);
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
}
for (const mobile of [false, true]) {
  test(`editor and session share complete lighting controls ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
    );
    const styles = [];
    for (const mode of ["editor", "board"]) {
      await page.goto(
        `/tests/maps/fixtures/maps.html?mode=${mode}&lightExample&lit`,
      );
      await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Освещение", exact: true })
        .click();
      const panel = page.getByRole("region", {
        name: "Освещение карты",
        exact: true,
      });
      await expect(
        panel.getByRole("switch", { name: "Освещение", exact: true }),
      ).toBeChecked();
      await expect(
        panel.getByRole("button", {
          name: "Добавить источник света",
          exact: true,
        }),
      ).toBeVisible();
      styles.push(
        await page
          .locator(".map-sidebar")
          .evaluate((el) => ({
            width: getComputedStyle(el).width,
            shadow: getComputedStyle(el).boxShadow,
          })),
      );
      await panel.getByRole("switch", { name: "Факел", exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(
            (mode) =>
              (mode === "editor" ? window.lastSaved : window.latestBoard)
                ?.document.lights[0].enabled,
            mode,
          ),
        )
        .toBe(false);
    }
    expect(styles[0]).toEqual(styles[1]);
  });
  test(`session area focus edits only its own document ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
    );
    await ready(page, "areaExample&hiddenArea");
    await page.getByRole("button", { name: "Области", exact: true }).click();
    await page
      .getByRole("region", { name: "Области карты" })
      .getByRole("button", { name: "Зал", exact: true })
      .click();
    const focus = page.getByRole("complementary", {
      name: "Выбранные элементы",
    });
    await expect(
      focus.getByRole("switch", { name: "Скрыть область «Зал»", exact: true }),
    ).toBeChecked();
    await focus
      .getByRole("switch", { name: "Скрыть область «Зал»", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => window.latestBoard.document.areas[0].hidden),
      )
      .toBe(false);
    expect(
      await page.evaluate(() => window.templateMap.document.areas[0].hidden),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Свернуть панель карты", exact: true })
      .click();
    await expect(page.locator(".map-sidebar")).toHaveClass(/collapsed/);
    await page.getByRole("button", { name: "Области", exact: true }).click();
    await expect(
      focus.getByRole("switch", { name: "Скрыть область «Зал»", exact: true }),
    ).not.toBeChecked();
  });
  test(`session solar edits are durable scene changes ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
    );
    await ready(page, "lightExample&lit");
    await page.getByRole("button", { name: "Освещение", exact: true }).click();
    await page
      .getByRole("switch", { name: "Дневной свет", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.latestBoard.document.sun.enabled))
      .toBe(true);
    const slider = page.getByRole("slider", {
      name: "Направление дневного света",
      exact: true,
    });
    await slider.focus();
    await slider.press("ArrowRight");
    await expect
      .poll(() => page.evaluate(() => window.latestBoard.document.sun.angle))
      .toBe(226);
    await page.getByRole("switch", { name: "Освещение", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => window.latestBoard.document.lightingEnabled),
      )
      .toBe(false);
    expect(
      await page.evaluate(() => window.latestBoard.state),
    ).not.toHaveProperty("lighting");
    expect(
      await page.evaluate(() => window.templateMap.document.sun.enabled),
    ).toBe(false);
  });
}
