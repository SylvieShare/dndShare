import { test, expect } from "@playwright/test";
async function pixel(page, point) {
  const png = await page.locator("canvas").screenshot();
  return page.evaluate(
    async ({ data, point }) => {
      const image = await createImageBitmap(
        new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], {
          type: "image/png",
        }),
      );
      const canvas = new OffscreenCanvas(image.width, image.height),
        ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      image.close();
      return [...ctx.getImageData(point.x, point.y, 1, 1).data];
    },
    { data: png.toString("base64"), point },
  );
}
test("V2 fills empty space above a tile, respects foreground depth, preserves background and releases its buffers", async ({
  page,
}) => {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /WebGL|Shader|GL_INVALID/.test(m.text()))
      errors.push(m.text());
  });
  await page.goto("/tests/maps/fixtures/volume.html");
  await page.waitForFunction(() => window.volumeTest?.ready);
  const p = await page.evaluate(() => window.volumeTest.pixel([0, 0.9, 0]));
  const empty = await pixel(page, p),
    background = await pixel(page, { x: 10, y: 10 });
  const textures = await page.evaluate(() => window.volumeTest.textures());
  await page.evaluate(() => window.volumeTest.frame(true));
  const cloud = await pixel(page, p);
  expect(cloud[0]).toBeGreaterThan(empty[0] + 30);
  const still = await page.locator("canvas").screenshot();
  await page.evaluate(() => window.volumeTest.advance());
  expect((await page.locator("canvas").screenshot()).equals(still)).toBe(false);
  const sameBackground = await pixel(page, { x: 10, y: 10 });
  for (let i = 0; i < 3; i++)
    expect(Math.abs(sameBackground[i] - background[i])).toBeLessThanOrEqual(1);
  await page.evaluate(() => window.volumeTest.frame(false, true));
  const wallPoint = await page.evaluate(() =>
      window.volumeTest.pixel([1.8, 2.2, 1.8]),
    ),
    wall = await pixel(page, wallPoint);
  await page.evaluate(() => window.volumeTest.frame(true, true));
  const occluded = await pixel(page, wallPoint);
  for (let i = 0; i < 3; i++)
    expect(Math.abs(occluded[i] - wall[i])).toBeLessThanOrEqual(3);
  await page.evaluate(() => window.volumeTest.frame(false));
  expect(await page.evaluate(() => window.volumeTest.textures())).toBe(
    textures,
  );
  expect(errors).toEqual([]);
});
