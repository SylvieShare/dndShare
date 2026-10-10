import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";
async function ready(page, extra = "") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=editor${extra}`);
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
const selection = (page) =>
  page.getByRole("complementary", { name: "Выбранные элементы", exact: true });
test("category cells fill each row and single selection shows preview, identity and coordinates on the canvas", async ({
  page,
}) => {
  await ready(page);
  const categories = page.getByRole("toolbar", { name: "Типы тайлов" });
  const bounds = await categories.boundingBox(),
    cells = await categories.getByRole("button").all();
  const first = await cells[0].boundingBox(),
    third = await cells[2].boundingBox();
  expect(first.width).toBeCloseTo((bounds.width - 12) / 3, 0);
  expect(third.x + third.width).toBeCloseTo(bounds.x + bounds.width, 0);
  expect(first.height).toBe(80);
  await expect(cells[0].locator("img")).toHaveAttribute("width", "64");
  await dragTile(page, await mapPoint(page, 4.5, 4.5));
  const panel = selection(page);
  await expect(
    panel.getByRole("heading", { name: "Пол 1", exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".map-selection-preview")).toBeVisible();
  await expect(panel.locator(".map-selected-heading small")).toContainText(
    "LC-007",
  );
  await expect(panel.locator("table td")).toHaveText(["4", "4", "0", "0°"]);
  const box = await panel.boundingBox(),
    canvas = await page.locator(".map-canvas").boundingBox();
  expect(box.height).toBeLessThan(canvas.height);
  expect(box.x + box.width).toBeCloseTo(canvas.x + canvas.width - 12, 0);
  await page.getByRole("button", { name: "Объекты", exact: true }).click();
  await page
    .getByRole("button", { name: "Сундук", exact: true })
    .press("Enter");
  const point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await expect(
    panel.getByRole("heading", { name: "Сундук", exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".map-selected-heading small")).toContainText(
    "MA-DungeonChest",
  );
});
test("area focus lists individual models and opening a row switches to the element inspector", async ({
  page,
}) => {
  await ready(page, "&areaExample&twoAreaObjects");
  await page.getByRole("button", { name: "Области", exact: true }).click();
  await page
    .getByRole("region", { name: "Области карты", exact: true })
    .getByRole("button", { name: "Зал", exact: true })
    .click();
  const panel = selection(page);
  await expect(panel.locator(".map-entity-row")).toHaveCount(4);
  await expect(panel.locator(".map-entity-count")).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Пол 1", exact: true })
    .first()
    .click();
  await expect(
    panel.getByRole("heading", { name: "Пол 1", exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".map-selection-preview")).toBeVisible();
  await panel
    .getByRole("button", { name: "Перейти к области «Зал»", exact: true })
    .click();
  await expect(panel.locator(".map-entity-row")).toHaveCount(4);
});
test("light rows toggle by switch, show their area, and anchor picking focuses the linked model", async ({
  page,
}) => {
  await ready(page, "&lightExample&shaped&lit");
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  const lights = page.getByRole("region", {
    name: "Освещение карты",
    exact: true,
  });
  await expect(
    lights.getByText("Выберите пресет через плюс", { exact: false }),
  ).toHaveCount(0);
  await expect(lights.getByLabel("Название источника света")).toHaveCount(0);
  await lights.getByRole("button", { name: "Факел", exact: true }).click();
  const panel = selection(page);
  await expect(panel.getByLabel("Название источника света")).toBeVisible();
  await lights.getByRole("switch", { name: "Факел", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.lights[0].enabled),
    )
    .toBe(false);
  await expect(
    lights.getByRole("switch", { name: "Факел", exact: true }),
  ).toBeVisible();
  await lights.getByRole("switch", { name: "Факел", exact: true }).click();
  await panel
    .getByRole("button", { name: "Добавить в область", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Создать область", exact: true })
    .click();
  await expect(
    lights.getByText("Факел (Область 1)", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Привязать", exact: true }).click();
  await expect(panel.getByRole("status")).toHaveText(
    "Нажмите на плитку или объект на карте.",
  );
  const point = await mapPoint(page, 4.2, 4.2);
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved?.document.lights[0].anchor?.kind),
    )
    .toBe("tile");
  await panel.getByRole("button", { name: "Пол 1", exact: true }).click();
  await expect(
    panel.getByRole("heading", { name: "Пол 1", exact: true }),
  ).toBeVisible();
});
test("autosave only opens an error popup on failure and records the last successful date in settings", async ({
  page,
}) => {
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Сохранить", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.evaluate(() => {
    window.failNextSave = 500;
  });
  await page
    .getByLabel("Название карты", { exact: true })
    .fill("Проверка автосохранения");
  await page.getByLabel("Название карты", { exact: true }).blur();
  const error = page.getByRole("dialog", {
    name: "Не удалось сохранить карту",
    exact: true,
  });
  await expect(error).toBeVisible();
  await expect(error.getByRole("alert")).toContainText("Нет связи");
  await error
    .getByRole("button", { name: "Повторить сохранение", exact: true })
    .click();
  await expect(error).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.name))
    .toBe("Проверка автосохранения");
  await expect(
    page.getByLabel("Последнее сохранение", { exact: true }).locator("time"),
  ).toHaveAttribute(
    "datetime",
    await page.evaluate(() => window.lastSaved.changedAt),
  );
});

test("single inspector has framed preview actions, tabular XYZ, and navigates to its area", async ({
  page,
}) => {
  await ready(page, "&areaExample");
  const point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.click(point.x, point.y);
  const panel = selection(page);
  await expect(
    panel.getByRole("status", { name: "Выбрано плиток" }),
  ).toHaveCount(0);
  await expect(panel.locator(".map-selected-frame")).toBeVisible();
  await expect(panel.locator(".map-selected-heading small")).toHaveText(
    /.+ · (LC-007|MA-DungeonChest)$/,
  );
  await expect(panel.locator("table th")).toHaveText([
    "X",
    "Y",
    "Z",
    "Поворот",
  ]);
  await expect(
    panel.getByRole("button", { name: "Удалить элемент", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Скопировать элемент", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("region", { name: "Область", exact: true }),
  ).toContainText("Зал");
  await panel
    .getByRole("button", {
      name: "Перейти к области «Зал»",
      exact: true,
    })
    .click();
  await expect(
    panel.getByLabel("Название области", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("heading", { name: "Зал", exact: true }),
  ).toBeVisible();
});

test("text can be selected and copied natively in the catalogue and the inspector", async ({
  page,
}) => {
  await ready(page);
  await dragTile(page, await mapPoint(page, 4.5, 4.5));
  await page.evaluate(() => {
    window.nativeCopies = [];
    window.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyC")
        window.nativeCopies.push(event.defaultPrevented);
    });
  });
  const name = page
    .getByRole("button", { name: "Пол 1", exact: true })
    .locator(".map-model-name");
  await selectText(page, name);
  expect(await page.evaluate(() => window.getSelection().toString())).toContain(
    "Пол",
  );
  await page.keyboard.press("Control+c");
  expect(await page.evaluate(() => window.nativeCopies)).toEqual([false]);
  await expect(page.locator(".map-controls-hint")).not.toContainText(
    "разместить плитку",
  );
  const title = selection(page).locator(".map-selected-heading h3");
  await selectText(page, title);
  expect(await page.evaluate(() => window.getSelection().toString())).toContain(
    "Пол",
  );
  await page.keyboard.press("Control+c");
  expect(await page.evaluate(() => window.nativeCopies)).toEqual([
    false,
    false,
  ]);
  await title.click();
  await selection(page)
    .getByRole("button", { name: "Скопировать элемент", exact: true })
    .click();
  const target = await mapPoint(page, 6.5, 4.5);
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press("Control+v");
  await page.mouse.click(target.x, target.y);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.some((t) => t.x === 6 && t.y === 4),
      ),
    )
    .toBe(true);
});

async function selectText(page, locator) {
  const bounds = await locator.evaluate((element) => {
    window.getSelection().removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(element);
    const r = range.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.mouse.move(bounds.x + 1, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width - 1,
    bounds.y + bounds.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
}

test("tile and chest lights follow the moving preview before save, and attached members commit together", async ({
  page,
}) => {
  await ready(page, "&areaExample&attachmentExample");
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lights.length))
    .toBe(2);
  const savedBefore = await page.evaluate(() => window.requests.length);
  const poses = () =>
    page.evaluate(() => {
      const result = {};
      window.attachmentScene?.traverse((node) => {
        if (node.isGroup && (node.userData.lightId || node.userData.objectId))
          result[node.userData.lightId || node.userData.objectId] =
            node.position.toArray();
      });
      return result;
    });
  const start = await mapPoint(page, 4.1, 4.1),
    end = await mapPoint(page, 6.1, 5.1);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await expect
    .poll(async () => {
      const current = await poses();
      return ["tile-lamp", "object-lamp", "area-chest"].map((id) =>
        Number(current[id]?.[0].toFixed(3)),
      );
    })
    .toEqual([6.2, 6.8, 6.5]);
  const current = await poses();
  expect(current["tile-lamp"][1]).toBeGreaterThan(1);
  expect(current["area-chest"][1]).toBeGreaterThan(0.6);
  expect(await page.evaluate(() => window.requests.length)).toBe(savedBefore);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.tiles[0].x))
    .toBe(6);
  const d = await page.evaluate(() => window.lastSaved.document);
  expect(d.objects[0]).toMatchObject({
    x: 6.5,
    y: 5.5,
    placement: { tileId: "area-floor", point: 0 },
  });
  for (const [id, x] of [
    ["tile-lamp", 6.2],
    ["object-lamp", 6.8],
  ]) {
    const light = d.lights.find((l) => l.id === id);
    expect(light.x).toBeCloseTo(x);
    expect(light.y).toBeCloseTo(5.5);
  }
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.objects[0].x))
    .toBe(4.5);
});
