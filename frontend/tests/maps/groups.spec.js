import { test, expect } from "@playwright/test";
import { mapPoint } from "./editorHelpers";
async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor&groups");
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}
test("flat neighbouring variants drag the concrete model", async ({ page }) => {
  await ready(page);
  await expect(
    page
      .locator('[data-group-code="LC-ground"]')
      .getByRole("heading", { name: "Пол", level: 4, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-model-group")).toHaveCount(0);
  const variant = page.getByRole("button", { name: "Пол 2", exact: true });
  await expect(variant).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Пол 1", exact: true }),
  ).toBeVisible();
  await variant.hover();
  const start = await variant.boundingBox(),
    point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(start.x + start.width / 2, start.y + 35);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 12 });
  await page.keyboard.press("r");
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find(
            (tile) => tile.x === 4 && tile.y === 4,
          )?.modelId,
      ),
    )
    .toBe("80808080-8080-4080-8080-808080808080");
  expect(
    await page.evaluate(
      () =>
        window.lastSaved.document.tiles.find(
          (tile) => tile.x === 4 && tile.y === 4,
        ).rotation,
    ),
  ).toBe(90);
});
test("flat tiles and objects keep individual light badges and placement", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("toolbar", { name: "Типы тайлов" })
    .getByRole("button", { name: "Стены", exact: true })
    .click();
  const walls = page.getByRole("complementary", { name: "Каталог плиток" });
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
  await page.getByRole("button", { name: "Пол 1", exact: true }).press("Enter");
  const point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await page.getByRole("button", { name: "Объекты", exact: true }).click();
  await page
    .getByRole("button", { name: "Открытый сундук", exact: true })
    .press("Enter");
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
test("section and variant codes edit independently while model identity and resources stay stable", async ({
  page,
}) => {
  await ready(page);
  const models = await page.evaluate(
    async () => await (await fetch("/api/maps/models")).json(),
  );
  expect(models.find((m) => m.id === "LC-007")).toMatchObject({
    uuid: "22222222-2222-4222-8222-222222222222",
    code: "LC-ground",
    variantCode: "LC-ground",
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
  await reference
    .getByLabel("Код вариантов", { exact: true })
    .fill("LC-ground-skins");
  await reference.getByLabel("Код вариантов", { exact: true }).blur();
  await reference
    .getByRole("button", { name: "Сохранить параметры", exact: true })
    .click();
  await expect(
    reference.getByText("Параметры сохранены", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.lastModelSaved)).toMatchObject({
    code: "LC-ground-special",
    variantCode: "LC-ground-skins",
    id: "22222222-2222-4222-8222-222222222222",
    definitionId: "LC-007",
  });
});
test("dragging the primary image retains the model shown on that image", async ({
  page,
}) => {
  await ready(page);
  const image = page
    .getByRole("button", { name: "Пол 1", exact: true })
    .locator("img");
  const start = await image.boundingBox(),
    point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find(
            (tile) => tile.x === 4 && tile.y === 4,
          )?.modelId,
      ),
    )
    .toBe("22222222-2222-4222-8222-222222222222");
});
