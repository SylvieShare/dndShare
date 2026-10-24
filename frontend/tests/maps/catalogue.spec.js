import { test, expect } from "@playwright/test";
import { mapPoint, choosePack } from "./editorHelpers";
async function ready(page, query = "") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=editor${query}`);
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
test("sidebar offers populated categories and drags tiles directly onto the map, with one hint per line", async ({
  page,
}) => {
  await ready(page);
  const sidebar = page.getByRole("complementary", { name: "Каталог плиток" });
  await expect(
    sidebar.getByRole("heading", { name: "Пол", level: 3, exact: true }),
  ).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /^Пол \(/ })).toHaveCount(0);
  await expect(
    sidebar.getByRole("button", { name: "Кисть стенами", exact: true }),
  ).toHaveCount(0);
  await expect(sidebar.getByLabel("Тип плитки", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    sidebar.getByLabel("Расположение стен", { exact: true }),
  ).toHaveCount(0);
  await expect(sidebar.locator(".map-model-card button")).toHaveCount(0);
  const picker = sidebar.getByRole("toolbar", { name: "Типы тайлов" });
  await expect(picker.getByRole("button")).toHaveCount(2);
  for (const name of [
    "Все тайлы",
    "Без стен",
    "Прямые стены",
    "Внутренние углы",
  ])
    await expect(picker.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  await picker.getByRole("button", { name: "Стены", exact: true }).click();
  await expect(
    sidebar.getByRole("button", { name: "Стена 1", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: "Угол стены", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("heading", { name: "Прямые стены", level: 5 }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("heading", { name: "Внутренние углы", level: 5 }),
  ).toBeVisible();
  for (const button of await picker.getByRole("button").all())
    await expect(button.locator("img")).toHaveCount(1);
  await picker.getByRole("button", { name: "Пол", exact: true }).click();
  const before = await page.locator(".map-canvas").boundingBox();
  await page.getByRole("button", { name: "Свернуть панель карты" }).click();
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(77);
  expect(await page.locator(".map-canvas").boundingBox()).toEqual(before);
  await page.getByRole("button", { name: "Плитки", exact: true }).click();
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(350);
  const card = await sidebar
    .getByRole("button", { name: "Пол 1", exact: true })
    .boundingBox();
  const point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(card.x + 30, card.y + 30);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some(
          (t) => t.x === 4 && t.y === 4 && t.modelId.startsWith("2222"),
        ),
      ),
    )
    .toBe(true);
  const commands = page
    .getByRole("list", { name: "Команды управления картой" })
    .getByRole("listitem");
  expect(await commands.count()).toBeGreaterThan(5);
  for (const text of await commands.allTextContents())
    expect(text).not.toContain(" · ");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("admin tile reference updates the current model while keeping placement IDs", async ({
  page,
}) => {
  await ready(page);
  await expect(
    page.getByRole("tab", { name: "Предметы", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".map-model-card button")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Справочник тайлов", exact: true })
    .click();
  const reference = page.getByRole("region", {
    name: "Справочник тайлов",
    exact: true,
  });
  await reference.getByRole("button", { name: "Пол 1", exact: true }).click();
  await page
    .getByLabel("Название (русский)", { exact: true })
    .fill("Исправленный пол");
  await page.getByLabel("Ширина тайла в клетках", { exact: true }).fill("2");
  await expect(
    page.getByLabel("Проработка текстур", { exact: true }),
  ).toHaveValue("basic");
  await page
    .getByLabel("Проработка текстур", { exact: true })
    .selectOption("detailed");
  await page
    .getByRole("button", { name: "Сохранить параметры", exact: true })
    .click();
  await expect(
    reference.getByText("Параметры сохранены", { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() => window.lastModelSaved);
  expect(saved).toMatchObject({
    name: "Исправленный пол",
    width: 2,
    textureDetail: "detailed",
  });
  expect(saved.id).toBe("22222222-2222-4222-8222-222222222222");
  expect(
    await page.evaluate(() =>
      window.requests.filter((r) => r.url === "/api/maps/test-map"),
    ),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Закрыть справочник тайлов", exact: true })
    .click();
  await expect(
    page
      .getByRole("complementary", { name: "Каталог плиток" })
      .getByRole("button", { name: "Исправленный пол", exact: true }),
  ).toBeVisible();
});
test("reference is hidden from a non-admin and a conflict keeps the edit draft", async ({
  page,
}) => {
  await page.goto("/tests/maps/fixtures/maps.html?mode=header&noAdmin");
  await expect(
    page.getByRole("button", { name: "Справочник тайлов", exact: true }),
  ).toHaveCount(0);
  await ready(page);
  await page
    .getByRole("button", { name: "Справочник тайлов", exact: true })
    .click();
  await page
    .getByLabel("Название (русский)", { exact: true })
    .fill("Черновик правки");
  await page.evaluate(() => {
    window.failNextModelSave = true;
  });
  await page
    .getByRole("button", { name: "Сохранить параметры", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("уже изменены");
  await expect(
    page.getByLabel("Название (русский)", { exact: true }),
  ).toHaveValue("Черновик правки");
  expect(await page.evaluate(() => window.lastModelSaved)).toBeUndefined();
});

test("the reference modal protects unsaved parameters until saved or cancelled", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Справочник тайлов", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Справочник тайлов",
    exact: true,
  });
  await modal
    .getByLabel("Название (русский)", { exact: true })
    .fill("Несохранённые параметры");
  await modal
    .getByRole("button", { name: "Закрыть справочник тайлов", exact: true })
    .click();
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("alert")).toContainText(
    "Сохраните или отмените",
  );
  await expect(
    modal.getByLabel("Название (русский)", { exact: true }),
  ).toHaveValue("Несохранённые параметры");
  await modal
    .getByRole("button", { name: "Отменить изменения", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "Закрыть справочник тайлов", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  expect(await page.evaluate(() => window.lastModelSaved)).toBeUndefined();
});

test("pack selection lives on the left, supports keyboard and stays available when collapsed", async ({
  page,
}) => {
  await ready(page);
  await expect(
    page.locator(".workspace-header").getByRole("combobox"),
  ).toHaveCount(0);
  const selector = page.getByRole("combobox", {
    name: "Пак тайлов",
    exact: true,
  });
  await selector.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("listbox", { name: "Паки тайлов" }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Lost Cave", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(selector).toHaveAttribute("title", "Ultimate Dungeon");
  await expect(
    page.getByRole("button", { name: "Каменный пол", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Свернуть панель карты" }).click();
  await page.getByRole("button", { name: "Плитки", exact: true }).click();
  await choosePack(page, "lost-cave");
  await page.getByRole("combobox", { name: "Пак тайлов", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox", { name: "Паки тайлов" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Пол 1", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.requests)).toEqual([]);
});
test("reference uses filter categories and preserves a draft when changing packs", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Справочник тайлов", exact: true })
    .click();
  await expect(page.getByLabel("Тип местности", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Форма стен", { exact: true })).toHaveCount(0);
  await expect(
    page
      .getByRole("toolbar", { name: "Форма тайла", exact: true })
      .getByRole("button"),
  ).toHaveCount(13);
  await page
    .getByRole("toolbar", { name: "Форма тайла", exact: true })
    .getByRole("button", { name: "Внутренние углы", exact: true })
    .click();
  await choosePack(page, "ultimate-dungeon");
  await expect(
    page.getByRole("dialog", {
      name: "Отменить изменения параметров?",
      exact: true,
    }),
  ).toContainText("Отменить изменения параметров?");
  await page
    .getByRole("button", { name: "Продолжить редактирование", exact: true })
    .click();
  await expect(
    page
      .getByRole("toolbar", { name: "Форма тайла", exact: true })
      .getByRole("button", { name: "Внутренние углы", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page
      .getByRole("region", { name: "Справочник тайлов", exact: true })
      .getByRole("combobox", { name: "Пак тайлов", exact: true }),
  ).toHaveAttribute("title", "Lost Cave");
  await page
    .getByRole("button", { name: "Сохранить параметры", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Справочник тайлов", exact: true })
      .getByRole("status"),
  ).toContainText("Параметры сохранены");
  const saved = await page.evaluate(() => window.lastModelSaved);
  expect(saved.tileType).toBe("wall-angle");
  expect(saved).not.toHaveProperty("wallLayout");
  expect(saved).not.toHaveProperty("terrainType");
  await page
    .getByRole("button", { name: "Закрыть справочник тайлов", exact: true })
    .click();
  const sidebar = page.getByRole("complementary", { name: "Каталог плиток" });
  await sidebar.getByRole("button", { name: "Пол", exact: true }).click();
  await expect(
    sidebar.getByRole("button", { name: "Пол 1", exact: true }),
  ).toBeVisible();
});

test("wall subcategories share common pack-independent WebP icons", async ({
  page,
}) => {
  await ready(page);
  const picker = page.getByRole("toolbar", {
    name: "Типы тайлов",
    exact: true,
  });
  const source = await picker
    .getByRole("button", { name: "Стены", exact: true })
    .locator("img")
    .getAttribute("src");
  await choosePack(page, "ultimate-dungeon");
  expect(
    await picker
      .getByRole("button", { name: "Стены", exact: true })
      .locator("img")
      .getAttribute("src"),
  ).toBe(source);
  await picker.getByRole("button", { name: "Стены", exact: true }).click();
  for (const name of ["Наружный угол", "Диагональная стена"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  for (const name of ["Наружные углы", "Диагональные стены"])
    await expect(
      page.getByRole("heading", { name, level: 5, exact: true }),
    ).toBeVisible();
});

test("optional occupancy and lighting filters default to all and retain one section", async ({
  page,
}) => {
  await ready(page, "&catalogueFilters");
  const sidebar = page.getByRole("complementary", { name: "Каталог плиток" });
  const section = sidebar.locator('[data-group-code="LC-ground"]');
  await expect(
    section.getByRole("button", { name: "Пол 1", exact: true }),
  ).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Пол с декором", exact: true }),
  ).toBeVisible();
  await sidebar
    .getByRole("button", { name: "Фильтры плиток", exact: true })
    .click();
  const filters = page.getByRole("dialog", {
    name: "Фильтры плиток",
    exact: true,
  });
  await expect(
    filters.getByRole("combobox", { name: "Наполнение плиток" }),
  ).toHaveText(/Любое наполнение/);
  await filters.getByRole("combobox", { name: "Наполнение плиток" }).click();
  await filters
    .getByRole("option", { name: "С предметами", exact: true })
    .click();
  await expect(
    section.getByRole("button", { name: "Пол 1", exact: true }),
  ).toHaveCount(0);
  await expect(
    section.getByRole("button", { name: "Пол с декором", exact: true }),
  ).toBeVisible();
  await filters.getByRole("combobox", { name: "Наполнение плиток" }).click();
  await filters
    .getByRole("option", { name: "Любое наполнение", exact: true })
    .click();
  await filters.getByRole("combobox", { name: "Освещение плиток" }).click();
  await filters
    .getByRole("option", { name: "Есть освещение", exact: true })
    .click();
  await expect(
    section.getByRole("button", { name: "Пол 1", exact: true }),
  ).toHaveCount(0);
  await expect(
    section.getByRole("button", { name: "Пол с декором", exact: true }),
  ).toBeVisible();
  await filters.getByRole("combobox", { name: "Освещение плиток" }).click();
  await filters
    .getByRole("option", { name: "Любое освещение", exact: true })
    .click();
  await page.keyboard.press("Escape");
  const picker = sidebar.getByRole("toolbar", {
    name: "Типы тайлов",
    exact: true,
  });
  for (const [category, name] of [
    ["Вода и реки", "Река"],
    ["Железная дорога", "Рельсы"],
  ]) {
    await picker.getByRole("button", { name: category, exact: true }).click();
    await expect(
      sidebar.getByRole("button", { name, exact: true }),
    ).toBeVisible();
  }
  await choosePack(page, "ultimate-dungeon");
  await expect(
    picker.getByRole("button", { name: "Железная дорога", exact: true }),
  ).toHaveCount(0);
});
