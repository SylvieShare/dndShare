import { expect, test } from "@playwright/test";
for (const mobile of [false, true])
  test(`fire is configured inside its light ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "warning" && /Invalid prop/.test(m.text()))
        errors.push(m.text());
    });
    await page.setViewportSize(
      mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
    );
    await page.goto(
      "/tests/maps/fixtures/maps.html?mode=editor&componentsExample",
    );
    await expect(page.locator(".map-canvas canvas")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Флаги", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Эффекты", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Освещение", exact: true }).click();
    await page
      .getByRole("button", { name: "Пол 1 · Свет", exact: true })
      .click();
    const focus = page.getByRole("complementary", {
      name: "Выбранные элементы",
    });
    await expect(
      focus.getByRole("switch", { name: "Показывать пламя", exact: true }),
    ).toBeChecked();
    await focus
      .getByRole("slider", { name: "Ширина пламени", exact: true })
      .fill("0.46");
    await expect
      .poll(() =>
        page.evaluate(
          () => window.lastSaved?.document.lights[0].effect.size[0],
        ),
      )
      .toBe(0.46);
    expect(
      await page.evaluate(
        () => window.lastSaved.document.lights[0].overrides.effect.size[0],
      ),
    ).toBe(0.46);
    await focus
      .getByRole("switch", { name: "Показывать пламя", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => window.lastSaved?.document.lights[0].effect.kind),
      )
      .toBe("none");
    await focus
      .getByRole("switch", { name: "Показывать пламя", exact: true })
      .click();
    await expect(
      focus.getByRole("slider", { name: "Ширина пламени", exact: true }),
    ).toHaveValue("0.46");
    await focus
      .getByRole("button", { name: "Выключить свет", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => window.lastSaved?.document.lights[0].enabled),
      )
      .toBe(false);
    const d = await page.evaluate(() => window.lastSaved.document);
    expect(d.lights[0].effect.kind).toBe("fire");
    expect(d.flags).toBeUndefined();
    expect(d.effects).toBeUndefined();
    expect(d.lights[0].effect.color).toBeUndefined();
    expect(errors).toEqual([]);
  });
