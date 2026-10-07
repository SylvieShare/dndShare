import { test, expect } from "@playwright/test";
async function ready(page, mode = "library") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=${mode}&tagsExample`);
}
test("available tags are searchable, intersected, and ordinary search also matches tag text", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator(".map-library-card")).toHaveCount(3);
  const tags = page.getByRole("combobox", { name: "Теги карт", exact: true });
  await tags.fill("лес");
  await page.getByRole("option", { name: "лес", exact: true }).click();
  await expect(page.locator(".map-library-card")).toHaveCount(2);
  await tags.fill("подзем");
  await page.getByRole("option", { name: "подземелье", exact: true }).click();
  await expect(page.locator(".map-library-card")).toHaveCount(1);
  await expect(page.locator(".map-library-name")).toHaveText(
    "Заброшенный храм",
  );
  await page
    .getByRole("button", { name: "Убрать тег: лес", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Убрать тег: подземелье", exact: true })
    .click();
  await page.getByLabel("Поиск карт", { exact: true }).fill("улица");
  await expect(page.locator(".map-library-name")).toHaveText("Лесная поляна");
});
test("settings choose existing tags, create string tags, and autosave their removal", async ({
  page,
}) => {
  await ready(page, "editor");
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const tags = page.getByRole("combobox", { name: "Теги карты", exact: true });
  await tags.fill("улица");
  await page.getByRole("option", { name: "улица", exact: true }).click();
  await tags.fill("Замок");
  await page
    .getByRole("button", { name: "Добавить тег «Замок»", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.tags))
    .toEqual(["подземелье", "камень", "улица", "Замок"]);
  await page
    .getByRole("button", { name: "Убрать тег: камень", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.tags))
    .toEqual(["подземелье", "улица", "Замок"]);
  await expect(
    page.getByRole("button", { name: "Загрузить фон", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Смещение X, %", { exact: true })).toHaveCount(0);
});
test("cards contain actual WebP snapshots and create immediately opens a 3D editor", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(page.locator(".map-thumbnail img")).toHaveCount(3, {
    timeout: 20000,
  });
  await expect
    .poll(() =>
      page
        .locator(".map-thumbnail img")
        .evaluateAll((images) =>
          images.every((img) => img.complete && img.naturalWidth > 400),
        ),
    )
    .toBe(true);
  const sizes = await page.locator(".map-thumbnail img").evaluateAll((images) =>
    images.map((img) => ({
      width: img.naturalWidth,
      height: img.naturalHeight,
      src: img.src,
    })),
  );
  sizes.forEach((size) => {
    expect(size.width).toBeGreaterThan(400);
    expect(size.height).toBeGreaterThan(250);
    expect(size.src).toMatch(/^blob:/);
  });
  const data = await page
    .locator(".map-thumbnail img")
    .first()
    .evaluate(async (img) => {
      const response = await fetch(img.src),
        blob = await response.blob(),
        bitmap = await createImageBitmap(blob);
      const c = new OffscreenCanvas(bitmap.width, bitmap.height),
        ctx = c.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
      let brown = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] > pixels[i + 2] * 1.2 && pixels[i] > 50) brown++;
      bitmap.close();
      return { mime: blob.type, brown };
    });
  expect(data.mime).toBe("image/webp");
  expect(data.brown).toBeGreaterThan(200);
  await page
    .getByRole("button", { name: "Создать карту", exact: true })
    .click();
  await expect(page.locator(".map-editor-workspace")).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Новая карта", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Изображение с сеткой", { exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
