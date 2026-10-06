import { test, expect } from "@playwright/test";
import { mapPoint } from "./editorHelpers";
async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
test("grouped sidebar collapses and drags tiles directly onto the map, with one hint per line", async ({
  page,
}) => {
  await ready(page);
  const sidebar = page.getByRole("complementary", { name: "Каталог плиток" });
  await expect(sidebar.getByRole("button", { name: /^Пол \(/ })).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: "Кисть стенами", exact: true }),
  ).toHaveCount(0);
  await expect(sidebar.getByLabel("Тип плитки", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    sidebar.getByLabel("Расположение стен", { exact: true }),
  ).toHaveCount(0);
  const picker = sidebar.getByRole("toolbar", { name: "Типы тайлов" });
  await expect(picker.getByRole("button")).toHaveCount(11);
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
  await picker.getByRole("button", { name: "Углы стен", exact: true }).click();
  await expect(
    sidebar.getByRole("button", { name: "Угол стены", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: "Стена 1", exact: true }),
  ).toHaveCount(0);
  for (const button of await picker.getByRole("button").all())
    await expect(button.locator("svg")).toHaveCount(1);
  await picker.getByRole("button", { name: "Пол", exact: true }).click();
  const before = await page.locator(".map-canvas").boundingBox();
  await page.getByRole("button", { name: "Свернуть список плиток" }).click();
  const collapsed = await page.locator(".map-canvas").boundingBox();
  expect(collapsed.width - before.width).toBe(238);
  await page.getByRole("button", { name: "Развернуть список плиток" }).click();
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
test("admin tile reference saves a fresh version and leaves existing map tiles unchanged", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("tab", { name: "Справочник тайлов", exact: true })
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
  await expect(page.getByRole("status")).toContainText([
    "Сохранено",
    "Параметры сохранены · версия 2",
  ]);
  const saved = await page.evaluate(() => window.lastModelSaved);
  expect(saved).toMatchObject({
    name: "Исправленный пол",
    width: 2,
    version: 2,
    textureDetail: "detailed",
  });
  expect(saved.id).not.toBe("22222222-2222-4222-8222-222222222222");
  expect(
    await page.evaluate(() =>
      window.requests.filter((r) => r.url === "/api/maps/test-map"),
    ),
  ).toEqual([]);
  await page.getByRole("tab", { name: "Карта", exact: true }).click();
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
    page.getByRole("tab", { name: "Справочник тайлов", exact: true }),
  ).toHaveCount(0);
  await ready(page);
  await page
    .getByRole("tab", { name: "Справочник тайлов", exact: true })
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

test("unsaved tile parameters survive view switching and must be saved or cancelled before leaving", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("tab", { name: "Справочник тайлов", exact: true })
    .click();
  await page
    .getByLabel("Название тайла", { exact: true })
    .fill("Несохранённые параметры");
  await page.getByRole("tab", { name: "Карта", exact: true }).click();
  await page
    .getByRole("tab", { name: "Справочник тайлов", exact: true })
    .click();
  await expect(page.getByLabel("Название тайла", { exact: true })).toHaveValue(
    "Несохранённые параметры",
  );
  await page
    .getByRole("button", { name: "Закрыть редактор", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Сохраните или отмените");
  await expect(
    page.getByRole("tab", { name: "Справочник тайлов", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Отменить изменения", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Закрыть редактор", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Создать карту", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.lastModelSaved)).toBeUndefined();
});

test("a tile shortcut opens that exact tile in the admin reference without starting placement", async ({
  page,
}) => {
  await ready(page);
  const sidebar = page.getByRole("complementary", { name: "Каталог плиток" });
  await sidebar
    .getByRole("toolbar", { name: "Типы тайлов" })
    .getByRole("button", { name: "Все стены", exact: true })
    .click();
  await sidebar
    .getByRole("button", { name: "Параметры LC-001: Стена 1", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Справочник тайлов", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Название тайла", { exact: true })).toHaveValue(
    "Стена 1",
  );
  await expect(page.getByLabel("Тип тайла", { exact: true })).toHaveValue(
    "wall",
  );
  const reference = page.getByRole("region", {
    name: "Справочник тайлов",
    exact: true,
  });
  await expect(
    reference.getByRole("button", { name: "Стена 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Карта", exact: true }).click();
  await expect(page.locator(".map-controls-hint")).not.toContainText(
    "разместить плитку",
  );
  expect(await page.evaluate(() => window.requests)).toEqual([]);
});
