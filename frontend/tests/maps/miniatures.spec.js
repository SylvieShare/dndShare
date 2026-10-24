import { test, expect } from "@playwright/test";
import { canvasFrame, mapPoint } from "./editorHelpers";
import { MINI_ID } from "./fixtures/miniatures.js";

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
    point = await mapPoint(page, 4.5, 4.5);
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
