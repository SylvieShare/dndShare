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
      section.getByRole("button", {
        name: "Погасить свет: Потухший факел",
        exact: true,
      }),
    ).toBeVisible();
    for (const name of ["Пол 1", "Угол стены"]) {
      await section
        .getByRole("button", { name: "Создать переход", exact: true })
        .click();
      const item = section.locator('[data-transition^="custom:"]').last();
      await item
        .getByRole("button", { name: "Выбрать тайл для перехода", exact: true })
        .click();
      const picker = page.getByRole("dialog", {
        name: "Выбрать тайл для перехода",
        exact: true,
      });
      if (name === "Угол стены")
        await picker
          .getByRole("button", { name: "Стены", exact: true })
          .click();
      await picker.getByRole("button", { name, exact: true }).click();
      await expect(picker).toHaveCount(0);
    }
    const targets = section.locator('[data-transition^="custom:"]');
    await expect(targets).toHaveCount(2);
    await targets
      .first()
      .getByRole("button", { name: "Перейти: Пол 1", exact: true })
      .click();
    await expect(
      panel.getByRole("heading", { name: "Пол 1", exact: true }),
    ).toBeVisible();
    await expect(
      section.getByRole("button", {
        name: "Погасить свет: Потухший факел",
        exact: true,
      }),
    ).toBeVisible();
    await expect(targets).toHaveCount(1);
    await expect(
      section.getByText("Этот вариант уже выбран", { exact: true }),
    ).toHaveCount(0);
    await targets
      .last()
      .getByRole("button", { name: "Перейти: Угол стены", exact: true })
      .click();
    await expect(
      panel.getByRole("heading", { name: "Угол стены", exact: true }),
    ).toBeVisible();
    await section
      .getByRole("button", { name: "Вернуться: Стена 1", exact: true })
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
    section.getByRole("button", {
      name: "Выбрать тайл для перехода",
      exact: true,
    }),
  ).toBeVisible();
});

for (const mode of ["editor", "board"])
  test(`transition rows are whole-card buttons without duplicate goals or model identifiers (${mode})`, async ({
    page,
  }) => {
    await ready(page, mode);
    await tileFocus(page);
    const panel = panelOf(page),
      section = panel.getByRole("region", {
        name: "Переходы модели",
        exact: true,
      });
    await section
      .getByRole("button", { name: "Создать переход", exact: true })
      .click();
    await section
      .getByRole("button", { name: "Выбрать тайл для перехода", exact: true })
      .click();
    const picker = page.getByRole("dialog", {
      name: "Выбрать тайл для перехода",
      exact: true,
    });
    await picker.getByRole("button", { name: "Стены", exact: true }).click();
    await picker
      .getByRole("button", { name: "Потухший факел", exact: true })
      .click();
    await expect(section.locator(".map-transition-item")).toHaveCount(1);
    const custom = section.getByRole("button", {
      name: "Перейти: Потухший факел",
      exact: true,
    });
    await expect(custom.locator("em")).toHaveText("Перейти");
    await expect(custom.locator("em")).toHaveCSS("font-style", "italic");
    await expect(custom.locator("small")).toHaveCount(0);
    await custom.press("Enter");
    await expect(
      panel.getByRole("heading", { name: "Потухший факел", exact: true }),
    ).toBeVisible();
    await expect(section.locator(".map-transition-item")).toHaveCount(1);
    await expect(
      section.getByText("Этот вариант уже выбран", { exact: true }),
    ).toHaveCount(0);
    await expect(
      section.getByRole("button", { name: /^Вернуться:/ }),
    ).toHaveCount(0);
    await section
      .getByRole("button", { name: "Зажечь свет: Стена 1", exact: true })
      .click();
    await expect(
      panel.getByRole("heading", { name: "Стена 1", exact: true }),
    ).toBeVisible();
    await expect(
      section.getByRole("button", {
        name: "Изменить цель перехода",
        exact: true,
      }),
    ).toHaveCount(0);
    const remove = custom.getByRole("button", {
      name: "Удалить кастомный переход",
      exact: true,
    });
    const cardBounds = await custom.boundingBox(),
      deleteBounds = await remove.boundingBox();
    expect(deleteBounds.x).toBeGreaterThan(cardBounds.x);
    expect(deleteBounds.x + deleteBounds.width).toBeLessThanOrEqual(
      cardBounds.x + cardBounds.width,
    );
    await remove.click();
    await expect(
      section.getByRole("button", {
        name: "Погасить свет: Потухший факел",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      panel.getByRole("heading", { name: "Стена 1", exact: true }),
    ).toBeVisible();
    await section
      .getByRole("button", { name: "Создать переход", exact: true })
      .click();
    await section
      .getByRole("button", { name: "Выбрать тайл для перехода", exact: true })
      .click();
    await picker.getByRole("button", { name: "Пол 1", exact: true }).click();
    await expect(section.locator(".map-transition-item")).toHaveCount(2);
    await section
      .getByRole("button", { name: "Перейти: Пол 1", exact: true })
      .click();
    await expect(
      panel.getByRole("heading", { name: "Пол 1", exact: true }),
    ).toBeVisible();
    await section
      .getByRole("button", { name: "Вернуться: Стена 1", exact: true })
      .click();
    await expect(
      panel.getByRole("heading", { name: "Стена 1", exact: true }),
    ).toBeVisible();
    await section
      .getByRole("button", { name: "Удалить кастомный переход", exact: true })
      .click();
    await expect(section.locator(".map-transition-item")).toHaveCount(1);
  });

for (const mode of ['editor', 'board']) test(`area reference shares the framed inspector card and keyboard activation (${mode})`, async ({ page }) => {
  await ready(page, mode)
  await tileFocus(page)
  const panel = panelOf(page)
  await expect(panel.locator('.workspace-focus-content')).toHaveClass(/base-tile/)
  await expect(panel.locator('.inspector-preview-frame')).toBeVisible()
  const link = panel.getByRole('button', { name: 'Перейти к области «Комната»', exact: true })
  await expect(link).toHaveClass(/inspector-reference/)
  await link.focus()
  await page.keyboard.press('Space')
  await expect(panel.getByRole('heading', { name: 'Комната', exact: true })).toBeVisible()
})
