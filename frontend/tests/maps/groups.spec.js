import { test, expect } from "@playwright/test";
import { mapPoint } from "./editorHelpers";
async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor&groups");
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
test("hover group card exposes all variants and permits dragging a concrete tile into the map", async ({
  page,
}) => {
  await ready(page);
  const group = page.getByRole("button", {
    name: "Группа LC-ground",
    exact: true,
  });
  await expect(group).toBeVisible();
  await expect(group.locator(".map-group-thumbnails img")).toHaveCount(2);
  await group.hover();
  const popup = page.getByRole("region", {
    name: "Варианты LC-ground",
    exact: true,
  });
  await expect(popup).toBeVisible();
  const variant = popup.getByRole("button", { name: "Пол 2", exact: true });
  await variant.hover();
  await expect(popup).toBeVisible();
  const start = await variant.boundingBox(),
    target = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(start.x + start.width / 2, start.y + 35);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.keyboard.press("r");
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) => t.x === 4 && t.y === 4)
            ?.modelId,
      ),
    )
    .toBe("80808080-8080-4080-8080-808080808080");
  expect(
    await page.evaluate(
      () =>
        window.lastSaved.document.tiles.find((t) => t.x === 4 && t.y === 4)
          .rotation,
    ),
  ).toBe(90);
});
test("embedded light badge marks only lit variants and grouped objects place the selected variant", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("toolbar", { name: "Типы тайлов" })
    .getByRole("button", { name: "Прямые стены", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Группа LC-wall", exact: true })
    .hover();
  const walls = page.getByRole("region", {
    name: "Варианты LC-wall",
    exact: true,
  });
  await expect(
    walls
      .getByRole("button", { name: "Стена 1", exact: true })
      .getByRole("img", { name: "Встроенный свет: 1", exact: true }),
  ).toBeVisible();
  await expect(
    walls
      .getByRole("button", { name: "Стена 2", exact: true })
      .getByRole("img"),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("toolbar", { name: "Типы тайлов" })
    .getByRole("button", { name: "Пол", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Группа LC-ground", exact: true })
    .hover();
  await page
    .getByRole("region", { name: "Варианты LC-ground", exact: true })
    .getByRole("button", { name: "Пол 1", exact: true })
    .press("Enter");
  const point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await page.getByRole("button", { name: "Объекты", exact: true }).click();
  await page
    .getByRole("button", { name: "Группа MA-chest", exact: true })
    .hover();
  const object = page
    .getByRole("region", { name: "Варианты MA-chest", exact: true })
    .getByRole("button", { name: "Открытый сундук", exact: true });
  await object.press("Enter");
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.objects.find(
            (o) => o.modelId === "82828282-8282-4282-8282-828282828282",
          )?.placement?.tileId,
      ),
    )
    .toBeTruthy();
});
test("catalogue ID is stable while uuid is an stable UUID and group code edits persist", async ({
  page,
}) => {
  await ready(page);
  const models = await page.evaluate(
    async () => await (await fetch("/api/maps/models")).json(),
  );
  expect(models.find((m) => m.id === "LC-007")).toMatchObject({
    uuid: "22222222-2222-4222-8222-222222222222",
    code: "LC-ground",
  });
  await page
    .getByRole("button", { name: "Справочник тайлов", exact: true })
    .click();
  const reference = page.getByRole("dialog", {
    name: "Справочник тайлов",
    exact: true,
  });
  await reference
    .getByLabel("Код группы", { exact: true })
    .fill("LC-ground-special");
  await reference.getByLabel("Код группы", { exact: true }).blur();
  await reference
    .getByRole("button", { name: "Сохранить параметры", exact: true })
    .click();
  await expect(
    reference.getByText("Параметры сохранены", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.lastModelSaved.code)).toBe(
    "LC-ground-special",
  );
});
