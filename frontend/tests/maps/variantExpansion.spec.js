import { test, expect } from "@playwright/test";
async function ready(page, mobile = false, reduced = false) {
  await page.setViewportSize(
    mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
  );
  await page.emulateMedia({
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=editor&groups&groupSections",
  );
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByRole("button", { name: "Плитки", exact: true }).click();
}
for (const mobile of [false, true])
  for (const reduced of [false, true])
    test(`variant card expands in place into one horizontal row (${mobile}, ${reduced})`, async ({
      page,
    }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await ready(page, mobile, reduced);
      const sections = page.locator(".map-model-section");
      await expect(sections).toHaveCount(2);
      await expect(
        sections.getByRole("heading", { name: "Пол", exact: true }),
      ).toBeVisible();
      const floor = page.locator(
        '.map-model-section[data-group-code="LC-ground"]',
      );
      await expect(floor.locator(".map-model-grid > *")).toHaveCount(2);
      const shell = floor.locator(".map-model-group");
      await expect(
        shell.locator(".map-variant-secondary .map-model-card"),
      ).toHaveCount(1);
      await expect(
        shell.locator(
          '[data-variant-id="22222222-2222-4222-8222-222222222222"]',
        ),
      ).toHaveCount(1);
      const before = await shell.boundingBox();
      await shell.locator(".map-variant-primary").evaluate((node) => {
        window.primaryVariantNode = node;
      });
      await shell.locator(".map-variant-primary").hover();
      const panel = page.getByRole("group", {
        name: "Варианты Пол",
        exact: true,
      });
      await expect(panel).toHaveAttribute("aria-expanded", "true");
      await expect
        .poll(async () => (await panel.boundingBox()).width)
        .toBeGreaterThan(before.width + 50);
      await expect
        .poll(async () =>
          Math.round(
            (await panel.locator(".map-model-card").first().boundingBox()).y -
              (await panel.locator(".map-model-card").last().boundingBox()).y,
          ),
        )
        .toBe(0);
      expect(
        await panel
          .locator(".map-variant-primary")
          .evaluate((node) => node === window.primaryVariantNode),
      ).toBe(true);
      await expect(panel.getByText(/×\d+/)).toHaveCount(0);
      await expect(page.locator(".map-group-variants")).toHaveCount(0);
      const bounds = await panel.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(mobile ? 430 : 1440);
      await page.keyboard.press("Escape");
      await expect(panel).toHaveAttribute("aria-expanded", "false");
      await expect
        .poll(async () => (await shell.boundingBox()).width)
        .toBeCloseTo(before.width, 0);
      await page.waitForTimeout(350);
      await expect(panel).toHaveAttribute("aria-expanded", "false");
      await shell.locator(".map-variant-primary").press("ArrowRight");
      await expect(panel).toHaveAttribute("aria-expanded", "true");
      await expect(
        panel.getByRole("button", { name: "Пол 2", exact: true }),
      ).toBeFocused();
      expect(errors).toEqual([]);
    });
