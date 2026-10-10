import { test, expect } from "@playwright/test";

for (const mobile of [false, true])
  test(`authenticated maps access ${mobile ? "mobile" : "desktop"}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize(mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 });
    for (const admin of [false, true]) {
      await page.goto(`/tests/maps/fixtures/access.html?${admin ? "admin&" : ""}${mobile ? "mobile" : ""}`);
      if (mobile) await page.getByRole("button", { name: "DnD Share" }).click();
      const library = page.getByRole("link", { name: "Карты", exact: true });
      await expect(library).toHaveAttribute("href", "/maps");
      await expect(library).not.toHaveAttribute("aria-disabled", "true");
      if (mobile) await page.getByRole("button", { name: "DnD Share" }).click();
      const tab = page.getByRole("button", { name: "Карта", exact: true });
      await expect(tab).not.toHaveAttribute("aria-disabled", "true");
      await tab.focus();
      await tab.press("Enter");
      await expect.poll(() => page.evaluate(() => window.selectedView)).toBe("maps");
      await expect(page.getByRole("tooltip")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

test("non-admin user can open their library and existing editor", async ({ page }) => {
  await page.goto("/tests/maps/fixtures/access.html?direct");
  await expect(page.getByRole("button", { name: "Создать карту", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.mapReads)).toBe(1);
  await page.goto("/tests/maps/fixtures/access.html?editor");
  await expect(page.locator(".map-editor-workspace")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.mapReads)).toBe(1);
  await expect(page.getByRole("button", { name: "Справочник тайлов", exact: true })).toHaveCount(0);
});

for (const editor of [false, true])
  test(`signed-out user cannot load private ${editor ? "editor" : "library"}`, async ({ page }) => {
    await page.goto(`/tests/maps/fixtures/access.html?anonymous&${editor ? "editor" : "direct"}`);
    await expect(page.getByRole("status")).toContainText("Войдите");
    expect(await page.evaluate(() => window.mapReads)).toBe(0);
    await expect(page.locator(".map-editor-workspace")).toHaveCount(0);
  });

test("session player does not get the DM map tab", async ({ page }) => {
  await page.goto("/tests/maps/fixtures/access.html?player");
  await expect(page.getByRole("button", { name: "Карта", exact: true })).toHaveCount(0);
});
