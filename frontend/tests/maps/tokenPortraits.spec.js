import { test, expect } from "@playwright/test";
import { mapPoint } from "./editorHelpers";

async function portraitPixels(page, canvas, points) {
  const png = await canvas.screenshot();
  const bounds = await canvas.boundingBox();
  return page.evaluate(
    async ({ base64, bounds, points }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const image = await createImageBitmap(
        new Blob([bytes], { type: "image/png" }),
      );
      const c = new OffscreenCanvas(image.width, image.height).getContext("2d");
      c.drawImage(image, 0, 0);
      return points.map((p) => {
        const pixels = c.getImageData(
          Math.round(p.x - bounds.x) - 24,
          Math.round(p.y - bounds.y) - 24,
          48,
          48,
        ).data;
        let cyan = 0,
          magenta = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] < 80 && pixels[i + 1] > 120 && pixels[i + 2] > 180)
            cyan++;
          if (pixels[i] > 180 && pixels[i + 1] < 80 && pixels[i + 2] > 180)
            magenta++;
        }
        return { cyan, magenta };
      });
    },
    { base64: png.toString("base64"), bounds, points },
  );
}

test("existing player and creature cylinders gain raster and delayed SVG icons on their top faces", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#00d8ff";
    ctx.fillRect(0, 0, 64, 128);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.route("**/player-portrait.png", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(base64, "base64"),
    }),
  );
  let release;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/svg/700", async (route) => {
    await ready;
    await route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64" viewBox="0 0 128 64"><rect width="128" height="64" fill="#ff00ee" /></svg>',
    });
  });
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=board&creatures&tokenPortraits",
  );
  const canvas = page.locator(".map-canvas canvas");
  await expect(canvas).toBeVisible();
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const points = [
    await mapPoint(page, 3.5, 3.5),
    await mapPoint(page, 4.5, 4.5),
  ];
  await expect
    .poll(async () => (await portraitPixels(page, canvas, points))[0].cyan)
    .toBeGreaterThan(80);
  expect((await portraitPixels(page, canvas, points))[1].magenta).toBe(0);
  release();
  await expect
    .poll(async () => (await portraitPixels(page, canvas, points))[1].magenta)
    .toBeGreaterThan(60);
  // A selection rebuild retains the already loaded images.
  await page.getByRole("button", { name: "Существа", exact: true }).click();
  await page
    .getByRole("region", { name: "Существа сессии" })
    .getByRole("button", { name: "A · Огр", exact: true })
    .click();
  await page.getByTitle("Показать всю карту", { exact: true }).click();
  const afterFocus = [
    await mapPoint(page, 3.5, 3.5),
    await mapPoint(page, 4.5, 4.5),
  ];
  await expect
    .poll(
      async () => (await portraitPixels(page, canvas, afterFocus))[1].magenta,
    )
    .toBeGreaterThan(60);
  // A normal save persists recovered URLs for the public display without inline image data.
  await page
    .locator(".map-sidebar")
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  await page.getByLabel("Показывать сетку", { exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.latestBoard?.state.tokens.find((t) => t.ref === "ogre")
            ?.imageUrl,
      ),
    )
    .toBe("/api/svg/700");
  expect(errors).toEqual([]);
});
