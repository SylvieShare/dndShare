import { test, expect } from "@playwright/test";
import { mapPoint } from "./editorHelpers";
test("camera placement and focus save a pose; broadcasting a captured view stays frozen after editor pan", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=board");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const expectedView = await page
    .locator(".map-canvas")
    .evaluate((el) => el.__vueParentComponent.exposed.captureCamera());
  await page.getByRole("button", { name: "Камеры", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить камеру", exact: true })
    .click();
  const focus = page.getByRole("complementary", { name: "Выбранные элементы" });
  await expect(focus.getByAltText("Вид из камеры")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => window.latestBoard?.document.cameras?.length),
    )
    .toBe(1);
  const created = await page.evaluate(
    () => window.latestBoard.document.cameras[0].view,
  );
  expect(created.target).toEqual(expectedView.target);
  created.up.forEach((n, i) => expect(n).toBeCloseTo(expectedView.up[i]));
  expect(created.width).toBeCloseTo(expectedView.width);
  expect(created.aspect).toBeCloseTo(expectedView.aspect);
  await focus.locator('[aria-label="Ширина кадра"] input').fill("12");
  await focus.locator('[aria-label="Ширина кадра"] input').press("Enter");
  await page
    .getByRole("button", { name: "Отобразить текущий вид", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.latestDisplay?.camera.view?.width || 0),
    )
    .toBeGreaterThan(0);
  const frozen = await page.evaluate(() => window.latestDisplay.camera.view);
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(160);
  await page.keyboard.up("ArrowRight");
  expect(await page.evaluate(() => window.latestDisplay.camera.view)).toEqual(
    frozen,
  );
  await page
    .getByRole("combobox", { name: "Камера трансляции", exact: true })
    .click();
  await page.getByRole("option", { name: "Камера 1", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => !!window.latestDisplay?.camera.sceneId))
    .toBe(true);
  expect(errors).toEqual([]);
});
test("switch dialog offers a session-only image mode", async ({ page }) => {
  await page.goto("/tests/maps/fixtures/maps.html?mode=board");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByRole("button", { name: "Сменить", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить 2D карту", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Добавить 2D карту" }),
  ).toBeVisible();
  await expect(page.locator("input[type=file]")).toHaveAttribute(
    "accept",
    "image/png,image/jpeg,image/webp",
  );
});

test("2D image mode hides 3D tools and places creatures at logical grid centres", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=board&creatures&imageMap",
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Плитки", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Камеры", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Изображение и сетка" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Существа", exact: true }).click();
  await page
    .getByRole("region", { name: "Существа сессии" })
    .getByRole("button", { name: "Лира", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Поставить на карту", exact: true })
    .click();
  const p = await mapPoint(page, 6.2, 5.8);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.latestBoard.state.tokens.find((t) => t.ref === "41")?.x,
      ),
    )
    .toBe(6.5);
  expect(
    await page.evaluate(
      () => window.latestBoard.state.tokens.find((t) => t.ref === "41").y,
    ),
  ).toBe(5.5);
  expect(errors).toEqual([]);
});

for (const mobile of [false, true])
  test(`map bars share glass surfaces and height ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
    );
    await page.goto("/tests/maps/fixtures/maps.html?mode=board");
    await expect(page.locator(".session-map-toolbar")).toHaveCount(2);
    const bars = await page
      .locator(".session-map-toolbar")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          height: node.getBoundingClientRect().height,
          blur: getComputedStyle(node).backdropFilter,
          background:
            getComputedStyle(node).backgroundColor +
            getComputedStyle(node).backgroundImage,
          overflow: node.scrollWidth > node.clientWidth,
        })),
      );
    expect(bars.map((b) => b.height)).toEqual([64, 64]);
    expect(
      bars.every(
        (b) => b.blur.includes("blur") && b.background.includes("0.76"),
      ),
      JSON.stringify(bars),
    ).toBe(true);
    expect(bars.some((b) => b.overflow)).toBe(false);
    const toolbar = page.locator(".session-map-toolbars");
    await expect(
      toolbar.getByRole("button", { name: "Вид игроков", exact: true }),
    ).toHaveCount(0);
    await expect(
      toolbar.getByRole("button", { name: "Экран карты", exact: true }),
    ).toHaveCount(0);
    await expect(toolbar.locator(".lucide-monitor-up")).toHaveCount(1);
  });
test("camera body moves freely with a stable height and look direction", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=board");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByRole("button", { name: "Камеры", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить камеру", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.latestBoard.document.cameras?.length),
    )
    .toBe(1);
  const before = await page.evaluate(
    () => window.latestBoard.document.cameras[0].view,
  );
  const host = await page.locator(".map-canvas-surface").boundingBox(),
    x = host.x + host.width / 2 + 2,
    y = host.y + host.height / 2 + 1;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await page.mouse.move(x + 23.7, y + 17.3, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.latestBoard.document.cameras[0].view.position[0],
      ),
    )
    .not.toBe(before.position[0]);
  const after = await page.evaluate(
    () => window.latestBoard.document.cameras[0].view,
  );
  expect(after.position[2]).toBe(before.position[2]);
  expect(after.target[2]).toBe(before.target[2]);
  for (let i = 0; i < 3; i++)
    expect(after.target[i] - after.position[i]).toBeCloseTo(
      before.target[i] - before.position[i],
    );
  expect(
    Math.abs(after.position[0] * 2 - Math.round(after.position[0] * 2)),
  ).toBeGreaterThan(0.001);
  expect(errors).toEqual([]);
});
