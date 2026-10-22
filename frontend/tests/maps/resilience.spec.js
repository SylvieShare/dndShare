import { test, expect } from "@playwright/test";
async function remove(page) {
  await page.goto("/tests/maps/fixtures/maps.html?mode=board&slowDelete");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByRole("button", { name: "Сменить", exact: true }).click();
  await page.getByRole("button", { name: /Убрать карту / }).click();
  const dialog = page.getByRole("dialog", { name: "Убрать карту из сессии?" });
  await dialog.getByRole("button", { name: "Убрать", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".session-map-choice-main")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => typeof window.finishMapDelete))
    .toBe("function");
}
test("session delete completes in the UI before the response and a failure uses bottom-right notifications", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await remove(page);
  await page.evaluate(() => {
    window.failMapDelete = true;
    window.finishMapDelete();
  });
  await expect(
    page.locator(".notification-stack [data-notification-type=error]"),
  ).toContainText("Не удалось удалить карту");
  await expect(page.locator(".session-map-choice-main")).toHaveCount(1);
});
test("successful background deletion does not reopen the removed map", async ({
  page,
}) => {
  await remove(page);
  await page.evaluate(() => window.finishMapDelete());
  await expect(page.locator(".session-map-choice-main")).toHaveCount(0);
  await expect(
    page.getByText("В сессии пока нет карт.", { exact: true }),
  ).toBeVisible();
});
test("catalogue connection failures retry in the manager and do not claim the model is absent", async ({
  page,
}) => {
  await page.goto("/tests/maps/fixtures/maps.html?mode=board&catalogueRetry");
  const dialog = page.getByRole("dialog", { name: "Проблемы загрузки карты" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Получение каталога");
  await expect(dialog).not.toContainText("Модель отсутствует в каталоге");
  await expect(
    page.getByRole("region", { name: "Загрузка моделей" }),
  ).toContainText("Повторяем загрузку");
  await dialog
    .getByRole("button", { name: "Закрыть сведения об ошибках", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.catalogueAttempts))
    .toBeGreaterThanOrEqual(3);
  await expect(
    page.getByRole("dialog", { name: "Проблемы загрузки карты" }),
  ).toHaveCount(0);
});
test("failed GLB files retry automatically and recover while the scene remains usable", async ({
  page,
}) => {
  await page.goto("/tests/maps/fixtures/maps.html?mode=board&modelRetry");
  const dialog = page.getByRole("dialog", { name: "Проблемы загрузки карты" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Получение файла");
  await expect(dialog).toContainText("Автоматические попытки продолжаются");
  await dialog
    .getByRole("button", { name: "Закрыть сведения об ошибках", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Загрузка моделей" }),
  ).toHaveCount(0, { timeout: 20000 });
  expect(
    await page.evaluate(() => Math.max(...Object.values(window.assetAttempts))),
  ).toBeGreaterThanOrEqual(3);
});
test("a genuinely absent model reports IDs and affected tiles through the shared modal", async ({
  page,
}) => {
  await page.goto("/tests/maps/fixtures/maps.html?mode=board&missingModel");
  const dialog = page.getByRole("dialog", { name: "Проблемы загрузки карты" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Модель отсутствует в каталоге");
  await expect(dialog).toContainText("deadbeef-0000-4000-8000-000000000001");
  await expect(dialog).toContainText("missing-tile");
  await expect(page.locator(".map-canvas-message")).toHaveCount(0);
});
test("the catalogue of an empty editor also retries through the shared manager", async ({
  page,
}) => {
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=editor&catalogueRetry&emptyScene",
  );
  const dialog = page.getByRole("dialog", { name: "Проблемы загрузки карты" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Получение каталога");
  await expect
    .poll(() => page.evaluate(() => window.catalogueAttempts))
    .toBeGreaterThanOrEqual(3);
  await expect(dialog).toHaveCount(0);
});
