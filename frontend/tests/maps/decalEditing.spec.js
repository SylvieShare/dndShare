import { expect, test } from "@playwright/test";
import { canvasFrame, dragDecal, mapPoint } from "./editorHelpers";

async function outlinePixels(page) {
  const frame = await canvasFrame(page);
  return page.evaluate(async (data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const image = await createImageBitmap(
      new Blob([bytes], { type: "image/png" }),
    );
    const canvas = new OffscreenCanvas(image.width, image.height),
      ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    image.close();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (
        pixels[i + 1] > pixels[i] + 30 &&
        pixels[i + 1] > pixels[i + 2] + 20 &&
        pixels[i + 1] > 100
      )
        count++;
    return count;
  }, frame.toString("base64"));
}

test("decal contour, hold drag, title rename and owner list", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /THREE|WebGL|shader/i.test(message.text())
    )
      errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor&lightExample");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByTitle("Вид сверху", { exact: true }).click();
  await page.getByRole("button", { name: "Декали", exact: true }).click();
  const p = await mapPoint(page, 4.5, 4.5);
  await dragDecal(page, "Лужа крови", p);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.decals?.length))
    .toBe(1);
  const focus = page.getByRole("complementary", { name: "Выбранные элементы" });
  await expect(focus.getByRole("combobox")).toHaveCount(0);
  await expect(focus.getByRole("textbox", { name: /Название/ })).toHaveCount(0);
  await focus.getByRole("button", { name: "Изменить название декали" }).click();
  await focus
    .getByRole("textbox", { name: "Название декали" })
    .fill("Кровь у входа");
  await focus.getByRole("button", { name: "Сохранить название" }).click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved.document.decals[0].name))
    .toBe("Кровь у входа");
  const before = await page.evaluate(
    () => window.lastSaved.document.decals[0].position,
  );
  await page.keyboard.press("Escape");
  await page.mouse.move(p.x + 1, p.y + 1);
  const hover = await outlinePixels(page);
  expect(hover).toBeGreaterThan(8);
  await page.mouse.click(p.x, p.y);
  const selected = await outlinePixels(page);
  expect(selected).toBeGreaterThan(hover);
  await page.mouse.down();
  await expect(page.locator(".map-pickup-ping")).toBeVisible();
  await page.mouse.move(p.x + 12, p.y + 5, { steps: 4 });
  expect(
    await page.evaluate(() => window.lastSaved.document.decals[0].position),
  ).toEqual(before);
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved.document.decals[0].position[0]),
    )
    .toBeGreaterThan(0.05);
  await page.keyboard.press("ControlOrMeta+z");
  await expect
    .poll(() =>
      page.evaluate(() => window.lastSaved.document.decals[0].position),
    )
    .toEqual(before);
  await page.mouse.click(p.x, p.y);
  await focus.getByRole("button", { name: "Пол 1", exact: true }).click();
  const list = focus.getByRole("region", { name: "Декали", exact: true });
  await expect(
    list.getByRole("button", { name: "Кровь у входа", exact: true }),
  ).toBeVisible();
  await expect(list.getByRole("button", { name: /Добавить/ })).toHaveCount(0);
  await list
    .getByRole("button", { name: "Кровь у входа", exact: true })
    .click();
  await expect(
    focus.getByRole("button", { name: "Изменить название декали" }),
  ).toBeVisible();
  await focus.getByRole("button", { name: "Пол 1", exact: true }).click();
  await list
    .getByRole("button", { name: "Удалить декаль «Кровь у входа»" })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved.document.decals))
    .toBeUndefined();
  await expect(list).toHaveCount(0);
  await expect(
    focus.getByRole("heading", { name: "Пол 1", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
