import { test, expect } from "@playwright/test";
import { mapPoint } from "./editorHelpers";
const panel = (page) =>
  page.getByRole("complementary", { name: "Выбранные элементы", exact: true });
async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor&transitions");
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const p = await mapPoint(page, 4.5, 4.5);
  await page.mouse.click(p.x, p.y);
  await expect(
    panel(page).getByRole("heading", { name: "Стена 1", exact: true }),
  ).toBeVisible();
}
test("embedded and attached lights are separate, toggle independently, and attached sources can detach", async ({
  page,
}) => {
  await ready(page);
  const lights = panel(page).getByRole("region", {
    name: "Освещение выбранной модели",
    exact: true,
  });
  await expect(
    lights.getByRole("heading", { name: "Встроенный свет", exact: true }),
  ).toBeVisible();
  await expect(
    lights.getByRole("heading", { name: "Прикреплённый свет", exact: true }),
  ).toBeVisible();
  await expect(
    lights.getByRole("button", {
      name: "Отвязать Прикреплённая лампа",
      exact: true,
    }),
  ).toBeVisible();
  await lights
    .getByRole("switch", { name: "Встроенный факел", exact: true })
    .uncheck();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.lights.find(
            (l) => l.builtinKey === "flame",
          )?.enabled,
      ),
    )
    .toBe(false);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.lights.find(
            (l) => l.builtinKey === "candle",
          )?.enabled,
      ),
    )
    .toBe(true);
  await lights
    .getByRole("button", { name: "Отвязать Прикреплённая лампа", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.lights.find(
            (l) => l.id === "attached-lamp",
          )?.anchor || null,
      ),
    )
    .toBe(null);
  await expect(
    lights.getByRole("heading", { name: "Прикреплённый свет", exact: true }),
  ).toHaveCount(0);
});
test("transition deletes both kinds of bound lights, keeps placement and area, and undo restores enabled states", async ({
  page,
}) => {
  await ready(page);
  await panel(page)
    .getByRole("switch", { name: "Встроенный факел", exact: true })
    .uncheck();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.lights.find(
            (l) => l.builtinKey === "flame",
          )?.enabled,
      ),
    )
    .toBe(false);
  await panel(page)
    .getByRole("button", { name: "Погасить свет", exact: true })
    .click();
  await expect(
    panel(page).getByRole("heading", { name: "Потухший факел", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lights.length))
    .toBe(0);
  const changed = await page.evaluate(() => window.lastSaved.document);
  expect(changed.tiles[0]).toMatchObject({
    id: "torch-tile",
    x: 4,
    y: 4,
    rotation: 0,
  });
  expect(changed.areas[0].tileIds).toEqual(["torch-tile"]);
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(
    panel(page).getByRole("heading", { name: "Стена 1", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lights.length))
    .toBe(3);
  expect(
    await page.evaluate(
      () =>
        window.lastSaved.document.lights.find((l) => l.builtinKey === "flame")
          .enabled,
    ),
  ).toBe(false);
  await panel(page)
    .getByRole("button", { name: "Погасить свет", exact: true })
    .click();
  await panel(page)
    .getByRole("button", { name: "Зажечь свет", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lights.length))
    .toBe(2);
  expect(
    await page.evaluate(() =>
      window.lastSaved.document.lights.every((l) => l.enabled),
    ),
  ).toBe(true);
});
test("model reference saves transition definitions and multiple light templates with the metadata revision", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Справочник тайлов", exact: true })
    .click();
  const reference = page.getByRole("dialog", {
    name: "Справочник тайлов",
    exact: true,
  });
  const catalogue = reference.locator(".map-reference-catalogue");
  await catalogue
    .getByRole("button", { name: "Прямые стены", exact: true })
    .click();
  await catalogue
    .getByRole("button", { name: "Группа LC-wall", exact: true })
    .hover();
  await page
    .getByRole("region", { name: "Варианты LC-wall", exact: true })
    .getByRole("button", { name: "Стена 1", exact: true })
    .click();
  await expect(
    reference.getByLabel("Переход 1: действие", { exact: true }),
  ).toHaveValue("extinguish");
  await reference
    .getByLabel("Встроенный источник 1: название", { exact: true })
    .fill("Настенный факел");
  await reference
    .getByLabel("Встроенный источник 1: название", { exact: true })
    .blur();
  await reference
    .getByRole("button", { name: "Сохранить параметры", exact: true })
    .click();
  await expect(
    reference.getByText("Параметры сохранены · версия 2", { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() => window.lastModelSaved);
  expect(saved.definitionId).toBe("LC-001");
  expect(saved.behaviour.defaultLights).toHaveLength(2);
  expect(saved.behaviour.defaultLights[0].name).toBe("Настенный факел");
  expect(saved.behaviour.transitions[0]).toMatchObject({
    toDefinitionId: "LC-001-OFF",
    action: "extinguish",
  });
});

test("object definitions are available in the same reference editor", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Справочник тайлов", exact: true })
    .click();
  const reference = page.getByRole("dialog", {
    name: "Справочник тайлов",
    exact: true,
  });
  await reference.getByRole("radio", { name: "Объекты", exact: true }).click();
  await reference.getByRole("button", { name: "Сундук", exact: true }).click();
  await expect(
    reference.getByRole("heading", {
      name: "MA-DungeonChest · Сундук",
      exact: true,
    }),
  ).toBeVisible();
  await reference
    .getByRole("button", { name: "Добавить встроенный источник", exact: true })
    .click();
  await reference
    .getByLabel("Встроенный источник 1: название", { exact: true })
    .fill("Магический сундук");
  await reference
    .getByLabel("Встроенный источник 1: название", { exact: true })
    .blur();
  await reference
    .getByRole("button", { name: "Сохранить параметры", exact: true })
    .click();
  await expect(
    reference.getByText("Параметры сохранены · версия 2", { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() => window.lastModelSaved);
  expect(saved.tileType).toBe("object");
  expect(saved.behaviour.defaultLights[0].name).toBe("Магический сундук");
});
