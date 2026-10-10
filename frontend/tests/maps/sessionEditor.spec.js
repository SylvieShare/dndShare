import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";
async function ready(page, extra = "") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/tests/maps/fixtures/maps.html?mode=board&creatures${extra}`,
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
test("session uses the full editor, writes its own scene and retains the template", async ({
  page,
}) => {
  await ready(page);
  const p = await mapPoint(page, 6.5, 3.5);
  await expect(
    page.getByRole("button", { name: "Жетоны и двери", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Транслировать карту", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".map-sidebar")
      .getByRole("separator", { name: "Вкладки редактора" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".map-sidebar-tabs > button")
      .evaluateAll((buttons) =>
        buttons.map((b) => b.getAttribute("aria-label")),
      ),
  ).toEqual([
    "Настройки",
    "Существа",
    "Плитки",
    "Освещение",
    "Объекты",
    "Области",
  ]);
  await expect(
    page.getByRole("button", { name: "Справочник тайлов", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("toolbar", { name: "Действия карты" }),
  ).toHaveCount(0);
  await dragTile(page, p);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.latestBoard.document.tiles.some((t) => t.x === 6 && t.y === 3),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(() =>
      window.templateMap.document.tiles.some((t) => t.x === 6 && t.y === 3),
    ),
  ).toBe(false);
  await expect(
    page.getByRole("complementary", { name: "Выбранные элементы" }),
  ).toBeVisible();
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.press("Delete");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.latestBoard.document.tiles.some((t) => t.x === 6 && t.y === 3),
      ),
    )
    .toBe(false);
  const writes = await page.evaluate(() =>
    window.requests.filter((r) => r.url === "/api/sessions/test/maps/test-map"),
  );
  expect(writes.length).toBeGreaterThan(0);
  expect(writes.at(-1).data).toHaveProperty("document");
  expect(writes.at(-1).data).toHaveProperty("state");
});
test("players and creatures have HP and a shared right focus, and placement is durable", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Существа", exact: true }).click();
  const roster = page.getByRole("region", { name: "Существа сессии" });
  await expect(
    roster.getByRole("button", { name: "Лира", exact: true }),
  ).toContainText("18");
  await expect(
    roster.getByRole("button", { name: "A · Огр", exact: true }),
  ).toContainText("23");
  await roster.getByRole("button", { name: "Лира", exact: true }).click();
  const focus = page.getByRole("complementary", { name: "Выбранные элементы" });
  await expect(
    focus.getByRole("heading", { name: "Лира", exact: true }),
  ).toBeVisible();
  await focus
    .getByRole("button", { name: "Поставить на карту", exact: true })
    .click();
  const p = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(p.x, p.y, { steps: 5 });
  await page.mouse.click(p.x, p.y);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.latestBoard.state.tokens.some(
          (t) => t.kind === "player" && t.ref === "41" && !!t.placement,
        ),
      ),
    )
    .toBe(true);
  await expect(
    focus.getByRole("table", { name: "Координаты выбранного элемента" }),
  ).toBeVisible();
  await focus
    .getByRole("switch", { name: "Скрыть от игроков", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.latestBoard.state.tokens.find((t) => t.ref === "41")?.hidden,
      ),
    )
    .toBe(true);
});
test("session settings show the source and open and switch independent copies", async ({
  page,
}) => {
  await ready(page);
  await page
    .locator(".map-sidebar")
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Основа карты" }),
  ).toContainText("Крепость на переправе");
  await page
    .getByRole("button", { name: "Открыть новую", exact: true })
    .click();
  const picker = page.getByRole("dialog", { name: "Открыть новую карту" });
  await picker
    .getByRole("button", { name: "Выбрать", exact: true })
    .first()
    .click();
  await expect(picker).toHaveCount(0);
  await page
    .locator(".map-sidebar")
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Переключить карту", exact: true })
    .click();
  const choices = page.getByRole("dialog", { name: "Переключить карту" });
  await expect(
    choices.getByRole("button", { name: "Крепость на переправе", exact: true }),
  ).toHaveCount(2);
  await choices
    .getByRole("button", { name: "Крепость на переправе", exact: true })
    .first()
    .click();
  await expect(choices).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
