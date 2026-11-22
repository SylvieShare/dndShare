import { test, expect } from "@playwright/test";
import { dragTile, mapPoint, pickTile, uncoverMapPoint } from "./editorHelpers";

test("map action dock aligns with zoom and animates the red delete action", async ({ page }) => {
  await page.setViewportSize({ width: 932, height: 704 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=board");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const tools = page.getByRole("toolbar", { name: "Действия на карте" });
  const zoom = page.getByRole("group", { name: "Масштаб карты" });
  const remove = tools.getByRole("button", { name: "Удалить выбор", exact: true });
  const width = () => tools.evaluate(node => node.getBoundingClientRect().width);
  const bottom = async locator => {
    const rect = await locator.boundingBox();
    return rect.y + rect.height;
  };
  await expect.poll(async () => Math.abs((await bottom(tools)) - (await bottom(zoom)))).toBeLessThan(1);
  const baseWidth = await width();
  await tools.evaluate(node => {
    window.editingToolWidths = [];
    new ResizeObserver(() => window.editingToolWidths.push(node.getBoundingClientRect().width)).observe(node);
  });

  const point = await mapPoint(page, 4.5, 4.5);
  await uncoverMapPoint(page, point);
  await page.mouse.click(point.x, point.y);
  await expect(remove).toBeVisible();
  expect(await remove.evaluate(button => {
    const probe = document.createElement("span");
    probe.style.color = "var(--danger)";
    button.append(probe);
    const red = getComputedStyle(probe).color;
    probe.remove();
    return getComputedStyle(button).color === red;
  })).toBe(true);
  await expect(tools.locator(".map-editing-tool-enter-active")).toHaveCount(0);
  const expandedWidth = await width();
  expect(expandedWidth).toBeGreaterThan(baseWidth + 48);
  const intermediateWidths = () => page.evaluate(
    ({ low, high }) => window.editingToolWidths.filter(value => value > low + 1 && value < high - 1),
    { low: baseWidth, high: expandedWidth },
  );
  expect((await intermediateWidths()).length).toBeGreaterThan(0);

  await page.evaluate(() => { window.editingToolWidths = []; });
  await remove.click();
  await expect.poll(width).toBeCloseTo(baseWidth, 0);
  expect((await intermediateWidths()).length).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.latestBoard.document.tiles.some(tile => tile.x === 4 && tile.y === 4))).toBe(false);
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await bottom(tools)).toBeLessThan(await bottom(zoom));
  await expect(tools.getByRole("button", { name: "Вставить", exact: true })).toBeVisible();
});

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
    page.on("pageerror", error => { throw error; });
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
