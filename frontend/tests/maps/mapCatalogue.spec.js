import { test, expect } from "@playwright/test";
async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=library&catalogueExample",
  );
  await expect(page.locator(".map-library-entry")).toHaveCount(1);
}
test("publishing locks the original and direct editor URLs show a read-only scene", async ({
  page,
}) => {
  await ready(page);
  await expect(
    page.getByRole("tab", { name: "Системные", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  const confirm = page.getByRole("dialog", {
    name: "Опубликовать карту?",
    exact: true,
  });
  await expect(confirm).toContainText("Изменять и удалять");
  await confirm
    .getByRole("button", { name: "Опубликовать", exact: true })
    .click();
  await expect(page.getByText("Опубликована", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Удалить карту", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    window.mapRouter.push({ name: "MapEditor", query: { id: "test-map" } }),
  );
  await expect(page.locator(".published-map")).toBeVisible();
  await expect(page.locator(".map-editor-workspace")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Создать копию", exact: true })
    .click();
  await expect(page.locator(".map-editor-workspace")).toBeVisible();
  expect(await page.evaluate(() => window.lastSaved.publishedAt)).toBeNull();
});
test("catalogue subscriptions, five-star replacement and removal use the same row and tile", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("tab", { name: "Каталог", exact: true }).click();
  const entry = page.locator(".map-library-entry");
  await expect(entry.getByText("Зал алхимика", { exact: true })).toBeVisible();
  await expect(entry.getByText("architect", { exact: true })).toBeVisible();
  await entry.getByRole("radio", { name: "5 из 5", exact: true }).click();
  await expect(
    entry.getByRole("radio", { name: "5 из 5", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await entry.getByRole("radio", { name: "3 из 5", exact: true }).click();
  await expect(
    entry.getByRole("radio", { name: "3 из 5", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    entry.getByRole("radio", { name: "3 из 5", exact: true }),
  ).toBeEnabled();
  await entry
    .getByRole("radio", { name: "3 из 5", exact: true })
    .press("ArrowRight");
  await expect(
    entry.getByRole("radio", { name: "4 из 5", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(entry.locator(".map-rating-caption")).toHaveText("4 · 3");
  await entry
    .getByRole("button", { name: "Снять оценку", exact: true })
    .click();
  await expect(
    entry.getByRole("button", { name: "Снять оценку", exact: true }),
  ).toHaveCount(0);
  await entry.getByRole("button", { name: "Подписаться", exact: true }).click();
  await page.getByRole("tab", { name: "Подписки", exact: true }).click();
  await expect(page.locator(".map-library-entry")).toHaveCount(1);
  await page.getByRole("button", { name: "Список", exact: true }).click();
  await expect(entry).toHaveClass(/--list/);
  await expect(entry.getByText("Зал алхимика", { exact: true })).toBeVisible();
  await entry.getByRole("button", { name: "Отписаться", exact: true }).click();
  await expect(
    page.getByText("Пока нет подписок", { exact: true }),
  ).toBeVisible();
});
test("published previews stay read-only and subscription unlocks copying", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("tab", { name: "Каталог", exact: true }).click();
  await page
    .getByRole("button", { name: "Открыть карту Зал алхимика", exact: true })
    .click();
  const preview = page.getByRole("dialog", {
    name: "Зал алхимика",
    exact: true,
  });
  await expect(preview.locator(".map-canvas canvas")).toBeVisible();
  await expect(
    preview.getByRole("button", { name: "Создать копию", exact: true }),
  ).toHaveCount(0);
  await expect(preview.locator(".map-tile-sidebar")).toHaveCount(0);
  await preview
    .getByRole("button", { name: "Подписаться", exact: true })
    .click();
  await expect(
    preview.getByRole("button", { name: "Создать копию", exact: true }),
  ).toBeVisible();
  await preview
    .getByRole("button", { name: "Создать копию", exact: true })
    .click();
  await expect(page.locator(".map-editor-workspace")).toBeVisible();
});
test("mobile rows retain rating controls without overflowing the page", async ({
  page,
}) => {
  await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Каталог", exact: true }).click();
  await page.getByRole("button", { name: "Список", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Подписаться", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("radio", { name: "4 из 5", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "4 из 5", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});

test("session picker subscribes and opens an independent catalogue map", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=board&catalogueExample");
  await page
    .locator(".map-sidebar")
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Открыть новую", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Открыть новую карту",
    exact: true,
  });
  await picker.getByRole("tab", { name: "Каталог", exact: true }).click();
  await picker
    .getByRole("button", { name: "Подписаться", exact: true })
    .click();
  await picker.getByRole("tab", { name: "Подписки", exact: true }).click();
  await picker.getByRole("button", { name: "Выбрать", exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.latestBoard?.source?.id))
    .toBe("catalogue-map");
  await expect(page.locator(".map-editor-workspace")).toBeVisible();
});
