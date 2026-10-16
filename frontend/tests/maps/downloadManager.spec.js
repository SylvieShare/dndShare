import { test, expect } from "@playwright/test";
for (const mobile of [false, true])
  test(`compact model downloads show real remaining bytes and use the common queue ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
    );
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      "/tests/maps/fixtures/maps.html?mode=board&downloadExample",
    );
    await expect(page.locator(".map-canvas canvas")).toBeVisible();
    await page.getByTitle("Вид сверху", { exact: true }).click();
    if (mobile)
      for (let i = 0; i < 6; i++)
        await page
          .getByRole("button", { name: "Увеличить", exact: true })
          .click();
    const panel = page.getByRole("region", { name: "Загрузка моделей" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Основные", { exact: true })).toBeVisible();
    await expect(panel.getByText("LOD", { exact: true })).toBeVisible();
    await expect(panel.getByText("Тени", { exact: true })).toBeVisible();
    await expect(panel).toContainText("В очереди");
    await expect(panel).not.toContainText("Объём уточняется");
    await expect
      .poll(() => page.evaluate(() => window.activeModelTransfers))
      .toBe(3);
    const before = await panel.locator(".map-download-total").innerText();
    await page.evaluate(() => window.advanceModelTransfers(0.5));
    await expect(panel.locator(".map-download-total")).not.toHaveText(before);
    await expect
      .poll(() => panel.getByRole("progressbar").evaluate((p) => p.value))
      .toBeGreaterThan(0);
    const bounds = await panel.boundingBox(),
      controls = await page.locator(".map-canvas-controls").boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(controls.y - 4);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(mobile ? 430 : 1440);
    await page.evaluate(() => window.advanceModelTransfers());
    await expect
      .poll(() => page.evaluate(() => window.modelTransfers.length))
      .toBeGreaterThan(3);
    expect(await page.evaluate(() => window.maxActiveModelTransfers)).toBe(3);
    await page.getByRole("button", { name: "Увеличить", exact: true }).click();
    await page.evaluate(() => window.finishModelTransfers());
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
