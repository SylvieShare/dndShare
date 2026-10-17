import { test, expect } from "@playwright/test";
for (const mobile of [false, true])
  test(`light rows have a framed power button and an independent shadow icon ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
    );
    await page.goto(
      "/tests/maps/fixtures/maps.html?mode=editor&lightExample&shaped&lit",
    );
    await expect(page.locator(".map-canvas canvas")).toBeVisible();
    await page.getByRole("button", { name: "Освещение", exact: true }).click();
    const panel = page.getByRole("region", { name: "Освещение карты" });
    const inspector = page.getByRole("complementary", {
      name: "Выбранные элементы",
    });
    const power = panel.getByRole("button", {
      name: "Выключить свет: Факел",
      exact: true,
    });
    await expect(power).toHaveAttribute("aria-pressed", "true");
    expect(
      await power.evaluate((button) => getComputedStyle(button).borderTopStyle),
    ).toBe("solid");
    expect(
      await power.evaluate((button) => getComputedStyle(button).borderTopWidth),
    ).toBe("1px");
    await power.focus();
    await power.press("Enter");
    await expect
      .poll(() =>
        page.evaluate(() => window.lastSaved?.document.lights[0].enabled),
      )
      .toBe(false);
    expect(
      await page.evaluate(() => window.lastSaved.document.lights[0].shadows),
    ).toBe(true);
    await expect(
      panel.getByRole("button", { name: "Включить свет: Факел", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(inspector).toHaveCount(0);
    await panel
      .getByRole("button", { name: "Включить свет: Факел", exact: true })
      .click();
    const shadows = panel.getByRole("button", {
      name: "Выключить тени: Факел",
      exact: true,
    });
    await expect(shadows).toHaveAttribute("aria-pressed", "true");
    await shadows.click();
    await expect
      .poll(() =>
        page.evaluate(() => window.lastSaved?.document.lights[0].shadows),
      )
      .toBe(false);
    expect(
      await page.evaluate(() => window.lastSaved.document.lights[0].enabled),
    ).toBe(true);
    await expect(
      panel.getByRole("button", { name: "Включить тени: Факел", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(inspector).toHaveCount(0);
    await panel
      .getByRole("button", { name: "Включить тени: Факел", exact: true })
      .press("Space");
    await expect
      .poll(() =>
        page.evaluate(() => window.lastSaved?.document.lights[0].shadows),
      )
      .toBe(true);
    await panel.getByRole("button", { name: "Факел", exact: true }).click();
    await expect(inspector).toBeVisible();
  });
