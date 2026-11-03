import { test, expect } from "@playwright/test";
import { dragTile, mapPoint, pickTile, uncoverMapPoint } from "./editorHelpers";

for (const width of [390, 834, 1920]) {
  test(`editing tools remain reachable and undo placement in a ${width}px window`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 1000 });
    await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
    await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
    const sidebar = page.locator(".map-sidebar");
    if (width < 1200) await expect(sidebar).toHaveClass(/map-sidebar--collapsed/);
    const tools = page.getByRole("toolbar", { name: "Действия на карте" });
    await expect(tools).toBeVisible();
    await expect(tools.getByRole("button", { name: "Отменить", exact: true })).toBeDisabled();
    await page.getByTitle("Вид сверху", { exact: true }).click();
    const before = await page.evaluate(() => window.latestBoard.document.tiles.length);
    await dragTile(page, await mapPoint(page, 4.5, 4.5));
    await expect.poll(() => page.evaluate(() => window.lastSaved?.document.tiles.length)).toBe(before + 1);
    const box = await tools.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(77);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await tools.getByRole("button", { name: "Отменить", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.lastSaved?.document.tiles.length)).toBe(before);
    await tools.getByRole("button", { name: "Повторить", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.lastSaved?.document.tiles.length)).toBe(before + 1);
  });
}

for (const width of [390,834,1920]) {
  test(`room fill is available without keyboard modifiers in a ${width}px window`,async ({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
    await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
    await page.getByTitle("Вид сверху",{exact:true}).click();
    await pickTile(page);
    const point=await mapPoint(page,4.5,4.5);await uncoverMapPoint(page,point);
    const tools=page.getByRole("toolbar",{name:"Действия на карте"});
    const fill=tools.getByRole("button",{name:"Заливка замкнутой области"});
    await fill.click();await expect(fill).toHaveAttribute("aria-pressed","true");
    expect(await page.evaluate(()=>window.requests.length)).toBe(0);
    await page.mouse.click(point.x,point.y);
    await expect.poll(()=>page.evaluate(()=>window.lastSaved?.document.tiles.filter(t=>t.modelId.startsWith("2222")).length)).toBe(48);
  });
}
