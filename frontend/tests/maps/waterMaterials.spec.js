import { test, expect } from "@playwright/test";
test("surface waves stay continuous when the same world surface has different model origins", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tests/maps/fixtures/waterMaterials.html");
  await page.waitForFunction(() => window.waterContinuity);
  expect(await page.evaluate(() => window.waterContinuity())).toBe(0);
  expect(errors).toEqual([]);
});
