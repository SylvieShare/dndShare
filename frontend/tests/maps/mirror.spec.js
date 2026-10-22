import { test, expect } from "@playwright/test";
import { dragTile, pickTile, mapPoint } from "./editorHelpers";
test('repeated T while a save is delayed retains the latest state without a conflict', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/tests/maps/fixtures/maps.html?mode=editor');
  await expect(page.locator('.map-canvas canvas')).toBeVisible();
  await page.getByTitle('Вид сверху',{exact:true}).click();
  await dragTile(page,await mapPoint(page,6.5,4.5));
  await page.keyboard.press('t');
  const mirrored = () => page.evaluate(() => !!window.lastSaved?.document.tiles.find(tile=>tile.x===6&&tile.y===4)?.mirrored);
  await expect.poll(mirrored).toBe(true);
  await page.evaluate(() => {
    const original=window.fetch;
    window.fetch=async (url,options={}) => {
      if(options.method==='PATCH' && String(url).includes('/maps/') && !window.mirrorSaveHeld) {
        window.mirrorSaveHeld=true;
        const response=await original(url,options);
        await new Promise(resolve=>{window.releaseMirrorSave=resolve});
        return response;
      }
      return original(url,options);
    };
  });
  await page.keyboard.press('t');
  await page.waitForFunction(()=>window.releaseMirrorSave);
  await page.keyboard.press('t');
  await page.waitForTimeout(1400);
  await page.evaluate(()=>window.releaseMirrorSave());
  await expect.poll(mirrored).toBe(true);
  await expect(page.getByRole('dialog',{name:'Не удалось сохранить карту'})).toHaveCount(0);
  await page.keyboard.press('t');
  await expect.poll(mirrored).toBe(false);
  expect(await page.evaluate(()=>Object.hasOwn(window.lastSaved.document.tiles.find(tile=>tile.x===6&&tile.y===4),'mirrored'))).toBe(false);
});
for (const mode of ["editor", "board"])
  test(`T mirrors tiles, preserves copy/paste and undo in ${mode}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/tests/maps/fixtures/maps.html?mode=${mode}`);
    await expect(page.locator(".map-canvas canvas")).toBeVisible();
    await page.getByTitle("Вид сверху", { exact: true }).click();
    await dragTile(page, await mapPoint(page, 6.5, 4.5));
    await page.keyboard.press("t");
    const record = () =>
      page.evaluate(
        (mode) => (mode === "editor" ? window.lastSaved : window.latestBoard),
        mode,
      );
    await expect
      .poll(
        async () =>
          (await record())?.document.tiles.find((t) => t.x === 6 && t.y === 4)
            ?.mirrored,
      )
      .toBe(true);
    await page.keyboard.press("Control+z");
    await expect
      .poll(
        async () =>
          !!(await record())?.document.tiles.find((t) => t.x === 6 && t.y === 4)
            ?.mirrored,
      )
      .toBe(false);
    await page.keyboard.press("Control+Shift+z");
    await expect
      .poll(
        async () =>
          !!(await record())?.document.tiles.find((t) => t.x === 6 && t.y === 4)
            ?.mirrored,
      )
      .toBe(true);
    await page.keyboard.press("Control+c");
    const point = await mapPoint(page, 8.5, 4.5);
    await page.mouse.move(point.x, point.y);
    await page.keyboard.press("Control+v");
    await page.mouse.click(point.x, point.y);
    await expect
      .poll(
        async () =>
          !!(await record())?.document.tiles.find((t) => t.x === 8 && t.y === 4)
            ?.mirrored,
      )
      .toBe(true);
    await page.keyboard.press("Control+c");
    const next = await mapPoint(page, 8.5, 6.5);
    await page.mouse.move(next.x, next.y);
    await page.keyboard.press("Control+v");
    await page.keyboard.press("t");
    await page.mouse.click(next.x, next.y);
    await expect
      .poll(async () => {
        const tile = (await record())?.document.tiles.find(
          (t) => t.x === 8 && t.y === 6,
        );
        return tile ? !!tile.mirrored : null;
      })
      .toBe(false);
    expect(errors).toEqual([]);
  });
test("T changes a catalogue tile before it is dropped", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByTitle("Вид сверху", { exact: true }).click();
  await pickTile(page);
  const point = await mapPoint(page, 6.5, 4.5);
  await page.mouse.move(point.x, point.y);
  await page.keyboard.press("t");
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) => t.x === 6 && t.y === 4)
            ?.mirrored,
      ),
    )
    .toBe(true);
});
