import { test, expect } from "@playwright/test";
import { canvasFrame, worldPoint } from "./editorHelpers";
import { MINI_ID, BASE_IDS } from "./fixtures/miniatures.js";

async function miniaturePixels(page) {
  const png = await canvasFrame(page);
  return page.evaluate(async (base64) => {
    const image = await createImageBitmap(
      new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
        type: "image/png",
      }),
    );
    const context = new OffscreenCanvas(image.width, image.height).getContext(
      "2d",
    );
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let cyan = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] < 80 && pixels[i + 1] > 100 && pixels[i + 2] > 150) cyan++;
    return cyan;
  }, png.toString("base64"));
}

test("placing an NPC loads its bound miniature and saves the bestiary ID", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=board&creatures&miniatures",
  );
  await page.getByRole("button", { name: "Существа", exact: true }).click();
  const row = page
    .getByRole("region", { name: "Существа сессии" })
    .getByRole("button", { name: "A · Огр", exact: true });
  const b = await row.boundingBox(),
    point = await worldPoint(page, 4.5, 4.5);
  await page.mouse.move(b.x + 25, b.y + 25);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.latestBoard.state.tokens.find((t) => t.ref === "ogre")?.itemId,
      ),
    )
    .toBe(1635);
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          window.loadedModels.some(
            (url) => url.includes(id) && url.endsWith("/lod"),
          ),
        MINI_ID,
      ),
    )
    .toBe(true);
  await expect(
    page.getByText("Не удалось загрузить карту", { exact: true }),
  ).toHaveCount(0);
  // Fetching a GLB alone does not prove it is drawn: unscaled grey stones
  // previously covered the entire coloured figure after reconciliation.
  await expect.poll(() => miniaturePixels(page)).toBeGreaterThan(50);
  expect(errors).toEqual([]);
});

test("an old placement gains a miniature without saving inferred item IDs", async ({
  page,
}) => {
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=board&creatures&miniatures&miniatureLegacy",
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (id) => window.loadedModels.some((url) => url.includes(id)),
        MINI_ID,
      ),
    )
    .toBe(true);
  const token = await page.evaluate(() =>
    window.latestBoard.state.tokens.find((t) => t.id === "old-ogre"),
  );
  expect(token).not.toHaveProperty("itemId");
  expect(
    await page
      .locator(".map-canvas")
      .evaluate(
        (el) =>
          el.__vueParentComponent.props.state.tokens.find(
            (t) => t.id === "old-ogre",
          ).itemId,
      ),
  ).toBe(1635);
});

test("the creature base toggle persists its random choice and R/T reach the selected miniature", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=board&creatures&miniatures&miniatureLegacy&miniatureBases");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByRole("button", { name: "Существа", exact: true }).click();
  const toggle = page.getByRole("switch", { name: "Использовать подставки", exact: true });
  await toggle.click();
  const token = () => page.evaluate(() => window.latestBoard.state.tokens.find(t => t.id === "old-ogre"));
  await expect.poll(async () => (await token()).baseModelId).toMatch(new RegExp(BASE_IDS.join("|")));
  const chosen = (await token()).baseModelId;
  await expect.poll(() => page.evaluate(id => window.loadedModels.some(url => url.includes(id)), chosen)).toBe(true);
  await toggle.click();
  await toggle.click();
  expect((await token()).baseModelId).toBe(chosen);
  await page.getByRole("region", { name: "Существа сессии" }).getByRole("button", { name: "A · Огр", exact: true }).locator(".p-name").click();
  await page.getByRole("menuitem", { name: "Выбрать на карте", exact: true }).click();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.press("r");
  await page.keyboard.press("t");
  await expect.poll(token).toMatchObject({ rotation: 90, mirrored: true, baseModelId: chosen });
  await page.getByTitle("Показать всю карту", { exact: true }).click();
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const point = await page.locator(".map-canvas").evaluate(async el => {
    const { OrthographicCamera, Vector3 } = await import("/node_modules/three/build/three.module.js");
    const { applySceneCamera } = await import("/src/features/maps/rendering/sceneCameraView.js");
    const camera = new OrthographicCamera();
    applySceneCamera(camera, el.__vueParentComponent.exposed.captureCamera());
    const p = new Vector3(4.5, .45, 4.5).project(camera);
    const bounds = el.querySelector("canvas").getBoundingClientRect();
    return { x: bounds.left + (p.x + 1) * bounds.width / 2, y: bounds.top + (1 - p.y) * bounds.height / 2 };
  });
  await page.mouse.move(point.x, point.y);
  await expect.poll(() => page.locator(".map-canvas").evaluate(el => el.__vueParentComponent.props.hoveredToken)).toBe("old-ogre");
  expect(errors).toEqual([]);
});
