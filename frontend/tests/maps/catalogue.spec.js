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
    sidebar.getByRole("heading", { name: "Пол", exact: true }),
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
  await expect(picker.getByRole("button")).toHaveCount(6);
  for (const name of ["Все стены", "Сложные стены"])
    await expect(picker.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  for (const name of ["Наружные углы (Corner)", "Диагональные стены"])
    await expect(picker.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  await expect(
    picker.getByRole("button", {
      name: "Выступы и окончания стен",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    picker.getByRole("button", { name: "Все тайлы", exact: true }),
  ).toHaveCount(0);
  await expect(
    picker.getByRole("button", { name: "Без стен", exact: true }),
  ).toHaveCount(0);
  await picker
    .getByRole("button", { name: "Прямые стены", exact: true })
    .click();
  await expect(
    sidebar.getByRole("button", { name: "Стена 1", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: "Пол 1", exact: true }),
  ).toHaveCount(0);
  await expect(
    picker.getByRole("button", { name: "Прямые стены", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await picker
    .getByRole("button", { name: "Внутренние углы (Angle)", exact: true })
    .click();
  await expect(
    sidebar.getByRole("button", { name: "Угол стены", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: "Стена 1", exact: true }),
  ).toHaveCount(0);
  for (const button of await picker.getByRole("button").all())
    await expect(button.locator("img")).toHaveCount(1);
  await picker.getByRole("button", { name: "Пол", exact: true }).click();
  const before = await page.locator(".map-canvas").boundingBox();
  await page.getByRole("button", { name: "Свернуть панель карты" }).click();
  const collapsed = await page.locator(".map-canvas").boundingBox();
  expect(collapsed.width - before.width).toBe(286);
  await page.getByRole("button", { name: "Плитки", exact: true }).click();
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
    .getByRole("list", { name: "Управление картой" })
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
    .getByLabel("Название тайла", { exact: true })
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
    .getByLabel("Название тайла", { exact: true })
    .fill("Черновик правки");
  await page.evaluate(() => {
    window.failNextModelSave = true;
  });
  await page
    .getByRole("button", { name: "Сохранить параметры", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("уже изменены");
  await expect(page.getByLabel("Название тайла", { exact: true })).toHaveValue(
    "Черновик правки",
  );
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
    .getByLabel("Название тайла", { exact: true })
    .fill("Несохранённые параметры");
  await modal
    .getByRole("button", { name: "Закрыть справочник тайлов", exact: true })
    .click();
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("alert")).toContainText(
    "Сохраните или отмените",
  );
  await expect(modal.getByLabel("Название тайла", { exact: true })).toHaveValue(
    "Несохранённые параметры",
  );
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
  await page.getByRole("button", { name: "Плитки", exact: true }).click();
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
      .getByRole("toolbar", { name: "Тип тайла", exact: true })
      .getByRole("button"),
  ).toHaveCount(13);
  await page
    .getByRole("toolbar", { name: "Тип тайла", exact: true })
    .getByRole("button", { name: "Внутренние углы (Angle)", exact: true })
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
      .getByRole("toolbar", { name: "Тип тайла", exact: true })
      .getByRole("button", { name: "Внутренние углы (Angle)", exact: true }),
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
  await sidebar
    .getByRole("button", { name: "Внутренние углы (Angle)", exact: true })
    .click();
  await expect(
    sidebar.getByRole("button", { name: "Пол 1", exact: true }),
  ).toBeVisible();
});

test("corner and diagonal have independent filters and use the same WebP icons across packs", async ({
  page,
}) => {
  await ready(page);
  const picker = page
    .getByRole("complementary", { name: "Каталог плиток" })
    .getByRole("toolbar", { name: "Типы тайлов" });
  const commonTypes = ["Пол", "Прямые стены"];
  const sources = await Promise.all(
    commonTypes.map((name) =>
      picker
        .getByRole("button", { name, exact: true })
        .locator("img")
        .getAttribute("src"),
    ),
  );
  for (const src of sources) expect(src).toMatch(/\.webp(?:\?|$)/);
  await choosePack(page, "ultimate-dungeon");
  expect(
    await Promise.all(
      commonTypes.map((name) =>
        picker
          .getByRole("button", { name, exact: true })
          .locator("img")
          .getAttribute("src"),
      ),
    ),
  ).toEqual(sources);
  await picker
    .getByRole("button", { name: "Наружные углы (Corner)", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Наружный угол", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Диагональная стена", exact: true }),
  ).toHaveCount(0);
  await picker
    .getByRole("button", { name: "Диагональные стены", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Диагональная стена", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Наружный угол", exact: true }),
  ).toHaveCount(0);
  expect(
    await picker
      .locator("img")
      .evaluateAll((images) =>
        images.every((img) => img.complete && img.naturalWidth === 192),
      ),
  ).toBe(true);
});

test("available categories ignore historical and hidden models, and one content variant is selected automatically", async ({
  page,
}) => {
  await ready(page, "&tileFilterExample");
  const sidebar = page.getByRole("complementary", { name: "Каталог плиток" });
  const picker = sidebar.getByRole("toolbar", {
    name: "Типы тайлов",
    exact: true,
  });
  const content = sidebar.getByRole("radiogroup", {
    name: "Наполнение плиток",
  });
  const categoryTitle = sidebar.getByRole("heading", {
    name: "Пол",
    exact: true,
  });
  expect((await categoryTitle.boundingBox()).y).toBeLessThan(
    (await picker.boundingBox()).y,
  );
  await expect(
    picker.getByRole("button", {
      name: "Внутренние углы (Angle)",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    picker.getByRole("button", { name: "Проходы и двери", exact: true }),
  ).toBeVisible();
  await content
    .getByRole("radio", { name: "С предметами", exact: true })
    .click();
  await expect(
    sidebar.getByRole("button", { name: "Пол с декором", exact: true }),
  ).toBeVisible();
  await picker
    .getByRole("button", { name: "Прямые стены", exact: true })
    .click();
  await expect(content).toHaveCount(0);
  await expect(
    sidebar.getByRole("button", { name: "Стена 1", exact: true }),
  ).toBeVisible();
  await picker
    .getByRole("button", { name: "Проходы и двери", exact: true })
    .click();
  await expect(content).toHaveCount(0);
  await expect(
    sidebar.getByRole("button", { name: "Проём с обстановкой", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByText("В выбранном паке пока нет плиток."),
  ).toHaveCount(0);
  await picker.getByRole("button", { name: "Пол", exact: true }).click();
  await expect(
    content.getByRole("radio", { name: "С предметами", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await choosePack(page, "ultimate-dungeon");
  await expect(content).toHaveCount(0);
  await expect(
    sidebar.getByRole("button", { name: "Каменный пол", exact: true }),
  ).toBeVisible();
  await expect(
    picker.getByRole("button", { name: "Наружные углы (Corner)", exact: true }),
  ).toHaveCount(0);
  await picker
    .getByRole("button", { name: "Прямые стены", exact: true })
    .click();
  await expect(content).toHaveCount(0);
  await expect(
    sidebar.getByRole("button", { name: "Боковая стена", exact: true }),
  ).toBeVisible();
  await choosePack(page, "lost-cave");
  await expect(
    content.getByRole("radio", { name: "С предметами", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    sidebar.getByRole("button", { name: "Пол с декором", exact: true }),
  ).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /^Пол \(/ })).toHaveCount(0);
});
