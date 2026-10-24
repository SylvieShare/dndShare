import { test, expect } from "@playwright/test";
async function ready(page, mobile = false) {
  await page.setViewportSize(
    mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
  );
  await page.goto("/tests/maps/fixtures/maps.html?mode=board");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
}
async function add(page) {
  await page
    .getByRole("button", { name: "Добавить карту", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Добавить новую 3D карту", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Выбрать", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("tablist", { name: "Карты сессии" }).getByRole("tab"),
  ).toHaveCount(2);
}
const state = (page) =>
  page.evaluate(
    async () => await (await fetch("/api/sessions/test/maps")).json(),
  );
test("tabs switch editing independently of the live map and broadcast controls stay in the header", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  const initial = await state(page);
  await add(page);
  const maps = page
    .getByRole("tablist", { name: "Карты сессии" })
    .getByRole("tab");
  await expect(maps.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(maps.first()).toContainText("В эфире");
  expect((await state(page)).display).toEqual(initial.display);
  await maps.first().click();
  await expect(maps.first()).toHaveAttribute("aria-selected", "true");
  await maps.nth(1).click();
  expect((await state(page)).display).toEqual(initial.display);
  await page
    .getByRole("toolbar", { name: "Трансляция карты" })
    .getByRole("button", { name: /Транслировать карту/ })
    .click();
  await expect
    .poll(async () => (await state(page)).display.mapId)
    .toBe("opened-1");
  await expect(maps.nth(1)).toContainText("В эфире");
  await expect(maps.first()).not.toContainText("В эфире");
  const header = await page.locator(".session-map-tabs-header").boundingBox(),
    canvas = await page.locator(".map-canvas").boundingBox();
  expect(canvas.y).toBeGreaterThanOrEqual(header.y + header.height);
  await expect(page.locator(".map-canvas .session-map-broadcast")).toHaveCount(
    0,
  );
  await page
    .getByRole("toolbar", { name: "Трансляция карты" })
    .getByRole("button", { name: "Остановить трансляцию", exact: true })
    .click();
  await expect(maps.nth(1)).not.toContainText("В эфире");
  expect(errors).toEqual([]);
});
test("each pencil renames its own snapshot and preserves the selected tab", async ({
  page,
}) => {
  await ready(page);
  await add(page);
  const before = await state(page);
  await page
    .getByRole("button", { name: /Переименовать карту/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Карта сессии",
    exact: true,
  });
  await dialog
    .getByRole("textbox", { name: "Название карты сессии", exact: true })
    .fill("Зал у ворот");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const after = await state(page);
  expect(after.maps[0].name).toBe("Зал у ворот");
  expect(after.maps[0].document).toEqual(before.maps[0].document);
  expect(after.maps[0].state).toEqual(before.maps[0].state);
  await expect(
    page.getByRole("tablist", { name: "Карты сессии" }).getByRole("tab").nth(1),
  ).toHaveAttribute("aria-selected", "true");
  expect(after.display).toEqual(before.display);
  await page
    .getByRole("button", { name: /Переименовать карту/ })
    .nth(1)
    .click();
  await dialog
    .getByRole("textbox", { name: "Название карты сессии", exact: true })
    .fill("Лестница");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Лестница", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
test("camera view action returns to the map on air without changing its broadcast", async ({
  page,
}) => {
  await ready(page);
  await page.locator(".map-canvas").evaluate((el) => {
    const canvas = el.__vueParentComponent.exposed;
    canvas.setView({
      ...canvas.getView(),
      fit: false,
      x: 4,
      y: 7,
      cellPixels: 72,
    });
  });
  await page
    .getByRole("button", { name: "Отобразить текущий вид", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).display.camera.view?.width || 0)
    .toBeGreaterThan(0);
  const original = (await state(page)).display;
  await add(page);
  await page
    .getByRole("button", {
      name: "Перейти к виду камеры трансляции",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("tablist", { name: "Карты сессии" })
      .getByRole("tab")
      .first(),
  ).toHaveAttribute("aria-selected", "true");
  await expect
    .poll(() =>
      page
        .locator(".map-canvas")
        .evaluate(
          (el) => el.__vueParentComponent.exposed.captureCamera()?.width,
        ),
    )
    .toBeCloseTo(original.camera.view.width);
  expect((await state(page)).display).toEqual(original);
});
for (const mobile of [false, true])
  test(`tab header fits ${mobile ? "mobile" : "desktop"} and the plus stays after the last tab`, async ({
    page,
  }) => {
    await ready(page, mobile);
    const geometry = await page
      .locator(".session-map-tabs-header")
      .evaluate((el) => ({
        width: el.clientWidth,
        scroll: el.scrollWidth,
        inner: innerWidth,
        plus: el
          .querySelector('[aria-label="Добавить карту"]')
          .getBoundingClientRect().x,
        last: el
          .querySelector('[role="tab"]')
          .parentElement.getBoundingClientRect().right,
      }));
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
    expect(geometry.plus).toBeGreaterThanOrEqual(geometry.last - 1);
    expect(geometry.plus).toBeLessThan(geometry.inner);
    await page
      .getByRole("button", { name: "Добавить карту", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Добавить 2D карту", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Добавить 2D карту", exact: true }),
    ).toBeVisible();
  });

test("overflowing tabs stay keyboard accessible with the pencil separate from selection", async ({
  page,
}) => {
  await ready(page, true);
  await add(page);
  const list = page.getByRole("tablist", { name: "Карты сессии" }),
    tabs = list.getByRole("tab");
  await tabs.nth(1).focus();
  await page.keyboard.press("Home");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: /Переименовать карту/ })
    .nth(1)
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Карта сессии",
    exact: true,
  });
  await dialog
    .getByRole("textbox", { name: "Название карты сессии", exact: true })
    .fill("Очень длинное название карты ".repeat(5));
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const sizes = await page
    .locator(".session-map-tabs-header")
    .evaluate((el) => ({
      width: el.clientWidth,
      scroll: el.scrollWidth,
      tabWidth: el.querySelectorAll('[role="tab"]')[1].getBoundingClientRect()
        .width,
    }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
  expect(sizes.tabWidth).toBeLessThanOrEqual(220);
  await expect(
    page.getByRole("button", { name: "Добавить карту", exact: true }),
  ).toBeVisible();
});
