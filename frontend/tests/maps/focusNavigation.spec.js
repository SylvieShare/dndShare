import { test, expect } from "@playwright/test";
const panelOf = (page) =>
  page.getByRole("complementary", { name: "Выбранные элементы" });
async function ready(page, mode) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=${mode}&transitions`);
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByRole("button", { name: "Области", exact: true }).click();
  await page
    .getByRole("region", { name: "Области карты" })
    .getByRole("button", { name: "Комната", exact: true })
    .click();
}
async function tileFocus(page) {
  await panelOf(page)
    .getByRole("button", { name: "Стена 1", exact: true })
    .click();
  await expect(
    panelOf(page).getByRole("heading", { name: "Стена 1", exact: true }),
  ).toBeVisible();
}
for (const mode of ["editor", "board"]) {
  test(`inspector links keep nested parents and direct selections start a fresh history (${mode})`, async ({
    page,
  }) => {
    await ready(page, mode);
    const panel = panelOf(page);
    await tileFocus(page);
    await expect(
      panel.getByRole("button", { name: "Назад к Комната", exact: true }),
    ).toBeVisible();
    await panel
      .getByRole("button", {
        name: "Стена 1 · Прикреплённая лампа",
        exact: true,
      })
      .click();
    await expect(
      panel.getByRole("heading", {
        name: "Стена 1 · Прикреплённая лампа",
        exact: true,
      }),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: "Назад к Стена 1", exact: true })
      .click();
    await expect(
      panel.getByRole("heading", { name: "Стена 1", exact: true }),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: "Назад к Комната", exact: true })
      .click();
    await expect(
      panel.getByRole("heading", { name: "Комната", exact: true }),
    ).toBeVisible();
    await expect(panel.getByRole("button", { name: /^Назад к / })).toHaveCount(
      0,
    );
    await tileFocus(page);
    await page.getByRole("button", { name: "Освещение", exact: true }).click();
    await page
      .getByRole("region", { name: "Освещение карты" })
      .getByRole("button", {
        name: "Стена 1 · Прикреплённая лампа",
        exact: true,
      })
      .click();
    await expect(
      panel.getByRole("heading", {
        name: "Стена 1 · Прикреплённая лампа",
        exact: true,
      }),
    ).toBeVisible();
    await expect(panel.getByRole("button", { name: /^Назад к / })).toHaveCount(
      0,
    );
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  });
  test(`tile custom transitions retain several targets, original variant, catalogue actions and undo (${mode})`, async ({
    page,
  }) => {
    await ready(page, mode);
    await tileFocus(page);
    const panel = panelOf(page),
      section = panel.getByRole("region", {
        name: "Переходы модели",
        exact: true,
      });
    await expect(
      section.getByRole("button", { name: "Погасить свет", exact: true }),
    ).toBeVisible();
    for (const name of ["Пол 1", "Угол стены"]) {
      await section
        .getByRole("button", { name: "Создать переход", exact: true })
        .click();
      const item = section.locator('[data-transition^="custom:"]').last();
      await expect(
        item.getByRole("button", { name: "Перейти", exact: true }),
      ).toBeDisabled();
      await item
        .getByRole("button", { name: "Выбрать тайл", exact: true })
        .click();
      const picker = page.getByRole("dialog", {
        name: "Выбрать тайл для перехода",
        exact: true,
      });
      if (name === "Угол стены")
        await picker
          .getByRole("button", { name: "Внутренние углы (Angle)", exact: true })
          .click();
      await picker.getByRole("button", { name, exact: true }).click();
      await expect(picker).toHaveCount(0);
    }
    const targets = section.locator('[data-transition^="custom:"]');
    await expect(targets).toHaveCount(2);
    await targets
      .first()
      .getByRole("button", { name: "Перейти", exact: true })
      .click();
    await expect(
      panel.getByRole("heading", { name: "Пол 1", exact: true }),
    ).toBeVisible();
    await expect(
      section.getByRole("button", { name: "Погасить свет", exact: true }),
    ).toBeVisible();
    await expect(targets).toHaveCount(2);
    await targets
      .last()
      .getByRole("button", { name: "Перейти", exact: true })
      .click();
    await expect(
      panel.getByRole("heading", { name: "Угол стены", exact: true }),
    ).toBeVisible();
    await section
      .getByRole("button", { name: "Вернуться", exact: true })
      .click();
    await expect(
      panel.getByRole("heading", { name: "Стена 1", exact: true }),
    ).toBeVisible();
    await expect(targets).toHaveCount(2);
    await targets
      .first()
      .getByRole("button", { name: "Удалить кастомный переход", exact: true })
      .click();
    await expect(targets).toHaveCount(1);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(targets).toHaveCount(2);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(targets).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window.lastSaved || window.latestBoard)?.document.tiles.find(
              (t) => t.id === "torch-tile",
            )?.transitions?.targets.length,
        ),
      )
      .toBe(1);
  });
}

test("a tile without catalogue transitions still offers creating a transition", async ({
  page,
}) => {
  const { dragTile, mapPoint } = await import("./editorHelpers");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
  await dragTile(page, await mapPoint(page, 4.5, 4.5));
  const section = panelOf(page).getByRole("region", {
    name: "Переходы модели",
    exact: true,
  });
  await expect(
    section.getByRole("button", { name: "Создать переход", exact: true }),
  ).toBeVisible();
  await section
    .getByRole("button", { name: "Создать переход", exact: true })
    .click();
  await expect(
    section.getByRole("button", { name: "Выбрать тайл", exact: true }),
  ).toBeVisible();
});
