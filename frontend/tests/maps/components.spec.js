import { expect, test } from "@playwright/test";

async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=editor&componentsExample",
  );
  await expect(
    page.getByRole("button", { name: "Флаги", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Флаги", exact: true }).click();
  await page
    .getByRole("button", { name: "Пол 1 · Горит", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Пол 1 · Горит", exact: true }),
  ).toBeVisible();
}
const saved = (page) => page.evaluate(() => window.lastSaved?.document);

test("flag links open independent light/fire editors, preserve visual edits and gate both", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(
    page.getByText("Зависимости (2)", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Пол 1 · Пламя", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Пол 1 · Пламя", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("slider", { name: "Ширина огня", exact: true })
    .fill("0.45");
  await expect(
    page.getByRole("slider", { name: "Частота анимации огня", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Пол 1 · Горит", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Пол 1 · Горит", exact: true }),
  ).toBeVisible();
  await page.getByRole("switch", { name: "Включён", exact: true }).click();
  await expect
    .poll(async () => (await saved(page))?.flags?.[0]?.enabled)
    .toBe(false);
  const d = await saved(page);
  expect(d.lights[0].enabled).toBe(true);
  expect(d.effects[0].enabled).toBe(true);
  expect(d.effects[0].size[0]).toBe(0.45);
  expect(d.effects[0].flagId).toBe(d.flags[0].id);
  expect(d.lights[0].flagId).toBe(d.flags[0].id);
  await expect(page.getByText("Выключен флагом", { exact: true })).toHaveCount(
    2,
  );
  await page.getByRole("button", { name: "Пол 1 · Свет", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Пол 1 · Свет", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Управляющий флаг", exact: true }),
  ).toHaveValue(d.flags[0].id);
  expect(errors).toEqual([]);
});

test("manual flags accept light/effect dependencies and deletion plus undo restores their links", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Добавить флаг", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Новый флаг", exact: true }),
  ).toBeVisible();
  const select = page.getByLabel("Добавить зависимость флага", { exact: true });
  await select.selectOption({ label: "Пол 1 · Свет · свет" });
  await page
    .getByRole("button", { name: "Привязать элемент", exact: true })
    .click();
  await select.selectOption({ label: "Пол 1 · Пламя · эффект" });
  await page
    .getByRole("button", { name: "Привязать элемент", exact: true })
    .click();
  await expect(
    page.getByText("Зависимости (2)", { exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await saved(page))?.flags?.length).toBe(2);
  const before = await saved(page),
    id = before.flags.find((f) => !f.builtinKey).id;
  expect(before.effects[0].flagId).toBe(id);
  expect(before.lights[0].flagId).toBe(id);
  await page.getByRole("button", { name: "Удалить флаг", exact: true }).click();
  await expect.poll(async () => (await saved(page))?.flags?.length).toBe(1);
  expect((await saved(page)).effects[0].flagId).toBe("");
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await saved(page))?.flags?.length).toBe(2);
  expect((await saved(page)).effects[0].flagId).toBe(id);
});

test("standalone fire can be placed, controlled by a flag and copied as an independent effect", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Эффекты", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить огонь", exact: true })
    .click();
  const box = await page.locator(".map-canvas").boundingBox();
  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.65);
  await expect(
    page.getByRole("heading", { name: "Огонь", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await saved(page))?.effects?.length).toBe(2);
  const flag = (await saved(page)).flags[0];
  await page
    .getByRole("combobox", { name: "Управляющий флаг", exact: true })
    .selectOption(flag.id);
  await page
    .getByRole("slider", { name: "Высота огня", exact: true })
    .fill("1.2");
  await page
    .getByRole("button", { name: "Скопировать элемент", exact: true })
    .click();
  await page.keyboard.press("Control+v");
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await expect.poll(async () => (await saved(page))?.effects?.length).toBe(3);
  const manual = (await saved(page)).effects.filter((e) => !e.builtinKey);
  expect(manual).toHaveLength(2);
  expect(manual[0].id).not.toBe(manual[1].id);
  expect(
    manual.every((e) => e.flagId === flag.id && e.size[1] === 1.2 && !e.anchor),
  ).toBe(true);
});

test("copying an extinguished model preserves its flag and creates independent component IDs", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("switch", { name: "Включён", exact: true }).click();
  await expect
    .poll(async () => (await saved(page))?.flags?.[0]?.enabled)
    .toBe(false);
  await page.getByRole("button", { name: "Пол 1", exact: true }).click();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  const box = await page.locator(".map-canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.6);
  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.6);
  await expect.poll(async () => (await saved(page))?.tiles?.length).toBe(2);
  const d = await saved(page);
  expect(d.flags).toHaveLength(2);
  expect(d.effects).toHaveLength(2);
  expect(d.lights).toHaveLength(2);
  expect(d.flags.every((f) => !f.enabled)).toBe(true);
  expect(new Set(d.flags.map((f) => f.id)).size).toBe(2);
  for (const effect of d.effects)
    expect(d.flags.find((f) => f.id === effect.flagId)?.anchor.id).toBe(
      effect.anchor.id,
    );
});
