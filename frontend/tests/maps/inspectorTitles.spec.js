import { test, expect } from "@playwright/test";
const panel = (page) =>
  page.getByRole("complementary", { name: "Выбранные элементы", exact: true });
async function ready(page, extra = "&areaExample") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=editor${extra}`);
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
}
test("area uses inline rename, the shared preview frame and a delete button beside it", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Области", exact: true }).click();
  await page
    .getByRole("region", { name: "Области карты" })
    .getByRole("button", { name: "Зал", exact: true })
    .click();
  const focus = panel(page);
  await expect(focus.getByRole("textbox")).toHaveCount(0);
  await expect(focus.locator(".inspector-entity-icon")).toBeVisible();
  await expect(
    focus.getByRole("button", { name: "Снять фокус области", exact: true }),
  ).toHaveCount(0);
  const preview = await focus.locator(".inspector-preview-frame").boundingBox(),
    remove = await focus
      .getByRole("button", { name: "Удалить область «Зал»", exact: true })
      .boundingBox();
  expect(remove.x).toBeGreaterThanOrEqual(preview.x + preview.width);
  await focus
    .getByRole("button", { name: "Изменить название области", exact: true })
    .click();
  const input = focus.getByRole("textbox", {
    name: "Название области",
    exact: true,
  });
  expect((await input.boundingBox()).width).toBeLessThan(
    (await focus.boundingBox()).width - 40,
  );
  await input.fill("Пещера");
  await input.press("Enter");
  await expect(
    focus.getByRole("heading", { name: "Пещера", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.areas[0].name))
    .toBe("Пещера");
  await focus.getByRole("button", { name: "Пол 1", exact: true }).click();
  const row = focus.getByRole("button", {
    name: "Перейти к области «Пещера»",
    exact: true,
  });
  await expect(row).toHaveClass(/base-tile--framed/);
  await row.locator("strong").click();
  await expect(
    focus.getByRole("heading", { name: "Пещера", exact: true }),
  ).toBeVisible();
});
test("ordinary lights rename from the heading without a persistent name field", async ({
  page,
}) => {
  await ready(page, "&lightExample&lit");
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  await page
    .getByRole("region", { name: "Освещение карты" })
    .getByRole("button", { name: "Факел", exact: true })
    .click();
  const focus = panel(page);
  await expect(focus.getByRole("textbox")).toHaveCount(0);
  await expect(focus.locator(".inspector-entity-icon")).toBeVisible();
  await focus
    .getByRole("button", {
      name: "Изменить название источника света",
      exact: true,
    })
    .click();
  const input = focus.getByRole("textbox", {
    name: "Название источника света",
    exact: true,
  });
  await input.fill("Огонёк");
  await input.press("Enter");
  await expect(
    focus.getByRole("heading", { name: "Огонёк", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lights[0].name))
    .toBe("Огонёк");
});
