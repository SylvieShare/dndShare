import { test, expect } from "@playwright/test";
test("scene is usable while one mesh is delayed, shows LOD before requesting full detail, and releases placeholders", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=board&slowModel=1111");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.loadedModels.some(
          (p) => p.includes("2222") && p.endsWith("/render"),
        ),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(() =>
      window.loadedModels.some(
        (p) => p.includes("1111") && p.endsWith("/render"),
      ),
    ),
  ).toBe(false);
  await expect(page.locator(".map-model-loading")).toBeVisible();
  await page.evaluate(() => window.releaseModelLoads());
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.loadedModels.some(
          (p) => p.includes("1111") && p.endsWith("/render"),
        ),
      ),
    )
    .toBe(true);
  // The full file is still blocked, but the coarse version already replaced every placeholder.
  await expect(page.locator(".map-model-loading")).toHaveCount(0);
  await page.evaluate(() => window.releaseModelLoads());
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});
