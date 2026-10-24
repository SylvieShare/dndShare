import { test, expect } from "@playwright/test";
import { mapPoint } from "./editorHelpers";
async function ready(page, extra = "") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/tests/maps/fixtures/maps.html?mode=board&creatures${extra}`,
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  const topView = page.getByTitle("Вид сверху", { exact: true });
  if (await topView.count()) await topView.click();
  await page.getByRole("button", { name: "Существа", exact: true }).click();
  return page.getByRole("region", { name: "Существа сессии" });
}
async function startDrag(page, row, point) {
  const bounds = await row.boundingBox();
  await page.mouse.move(bounds.x + 25, bounds.y + 25);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 12 });
}
const saved = (page) => page.evaluate(() => window.latestBoard.state.tokens);
const canvasTokens = (page) =>
  page
    .locator(".map-canvas")
    .evaluate((el) => el.__vueParentComponent.props.state.tokens);
test("a Large handbook creature previews and saves at 2×2 on its first placement", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const roster = await ready(page, "&largeCreature");
  await startDrag(page, roster.getByRole("button", { name: "A · Огр", exact: true }), await mapPoint(page, 4.5, 4.5));
  await expect.poll(async () => (await canvasTokens(page)).find(t => t.id === "preview-token")?.size).toBe(2);
  expect((await saved(page)).some(t => t.ref === "ogre")).toBe(false);
  await page.mouse.up();
  await expect.poll(async () => (await saved(page)).find(t => t.ref === "ogre")?.size).toBe(2);
  expect(errors).toEqual([]);
});
test("roster drags preview before committing, mark placed creatures and focus their real position on click", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const roster = await ready(page);
  const row = roster.getByRole("button", { name: "Лира", exact: true });
  await row.locator('.p-avatar').click();
  await page.keyboard.press('Escape');
  await expect(row).not.toHaveClass(/base-tile--framed/);
  await expect(
    roster.getByRole("button", { name: /Поставить на карту:|Найти на карте:/ }),
  ).toHaveCount(0);
  const p = await mapPoint(page, 4.5, 4.5);
  await startDrag(page, row, p);
  await expect
    .poll(async () =>
      (await canvasTokens(page)).some((t) => t.id === "preview-token"),
    )
    .toBe(true);
  expect((await saved(page)).some((t) => t.ref === "41")).toBe(false);
  await page.mouse.up();
  await expect
    .poll(async () =>
      (await saved(page)).some((t) => t.ref === "41" && !!t.placement),
    )
    .toBe(true);
  await expect(row).toHaveCSS("--participant-frame-width", "2px");
  expect(
    await row.evaluate((el) => getComputedStyle(el).getPropertyValue("--participant-frame-width")),
  ).toBe("2px");
  expect(
    await row.evaluate((el) => el.style.getPropertyValue("--participant-color")),
  ).toBe("var(--accent)");
  const focus = page.getByRole("complementary", { name: "Выбранные элементы" });
  await expect(focus.locator(".workspace-focus-content")).not.toHaveClass(
    /base-tile--framed/,
  );
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(150);
  await page.keyboard.up("ArrowRight");
  await row.locator('.p-avatar').click();
  await page.keyboard.press('Escape');
  await expect(
    focus.getByRole("heading", { name: "Лира", exact: true }),
  ).toBeVisible();
  const free = await page.evaluate(() => {
    const canvas = document
      .querySelector(".map-canvas")
      .getBoundingClientRect();
    const left = document
      .querySelector(".map-sidebar")
      .getBoundingClientRect().right;
    const right = document
      .querySelector(".map-selection-panel")
      .getBoundingClientRect().left;
    return { x: (left + right) / 2, y: (canvas.top + canvas.bottom) / 2 };
  });
  await expect
    .poll(() =>
      page.locator(".map-canvas").evaluate(
        (el, p) =>
          el.__vueParentComponent.exposed.pointAt({
            clientX: p.x,
            clientY: p.y,
          })?.x,
        free,
      ),
    )
    .toBeCloseTo(4.5, 0);
  const previous = (await saved(page)).find((t) => t.ref === "41");
  const next = await mapPoint(page, 5.5, 4.5);
  await startDrag(page, row, next);
  await expect
    .poll(
      async () =>
        (await canvasTokens(page)).filter((t) => t.ref === "41").length,
    )
    .toBe(1);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await saved(page)).find((t) => t.ref === "41")).toEqual(previous);
  expect(errors).toEqual([]);
});
test("roster drops outside the field or on invalid surfaces never create a creature", async ({
  page,
}) => {
  const roster = await ready(page);
  const row = roster.getByRole("button", { name: "A · Огр", exact: true });
  await startDrag(page, row, { x: 1450, y: 1100 });
  await page.mouse.up();
  expect((await saved(page)).some((t) => t.ref === "ogre")).toBe(false);
  await startDrag(page, row, await mapPoint(page, 11.5, 9.5));
  await page.mouse.up();
  expect((await saved(page)).some((t) => t.ref === "ogre")).toBe(false);
  await startDrag(page, row, await mapPoint(page, 4.5, 4.5));
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await page.mouse.up();
  expect((await saved(page)).some((t) => t.ref === "ogre")).toBe(false);
});

test("dragging a creature onto a 2D map snaps to logical grid centres", async ({
  page,
}) => {
  const roster = await ready(page, "&imageMap");
  await startDrag(
    page,
    roster.getByRole("button", { name: "Лира", exact: true }),
    await mapPoint(page, 6.2, 5.8),
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await saved(page)).find((t) => t.ref === "41")?.x)
    .toBe(6.5);
  expect((await saved(page)).find((t) => t.ref === "41").y).toBe(5.5);
});

test('dead creatures move to their own group and revive without rewriting map placement', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const roster = await ready(page, '&tokenPortraits');
  const ogre = roster.getByRole('button', { name: 'A · Огр', exact: true });
  await startDrag(page, ogre, await mapPoint(page, 4.5, 4.5));
  await page.mouse.up();
  await expect.poll(async () => (await saved(page)).some(t => t.ref === 'ogre')).toBe(true);
  const before = (await saved(page)).find(t => t.ref === 'ogre');
  await ogre.locator('.p-name').click();
  await page.getByText('Отношение', { exact: true }).click();
  await page.getByRole('menuitem', { name: 'Союзник', exact: true }).click();
  await expect(ogre).toHaveAttribute('data-relation', 'ally');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.creatureEncounter.encounter.combatants[0].position = 'dead'; });
  const deadGroup = roster.locator('.map-creature-group').filter({ has: page.getByRole('heading', { name: /^Умершие / }) });
  await expect(deadGroup.getByRole('button', { name: 'A · Огр', exact: true })).toBeVisible();
  await expect(roster.locator('.map-creature-group').filter({ has: page.getByRole('heading', { name: /^Существа / }) }).getByRole('button', { name: 'A · Огр', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await canvasTokens(page)).find(t => t.ref === 'ogre')?.dead).toBe(true);
  expect((await saved(page)).find(t => t.ref === 'ogre')).toEqual(before);
  await page.evaluate(() => { window.creatureEncounter.encounter.combatants[0].position = 'reserve'; });
  await expect(deadGroup.getByRole('button', { name: 'A · Огр', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await canvasTokens(page)).find(t => t.ref === 'ogre')?.dead).toBe(false);
  expect((await saved(page)).find(t => t.ref === 'ogre')).toEqual(before);
  expect(errors).toEqual([]);
});


test('the whole map tile opens its menu, keyboard works and dragging does not open it', async ({ page }) => {
  const roster = await ready(page);
  const tile = roster.getByRole('button', { name: 'Лира', exact: true });
  await expect(tile.locator('.map-creature-actions')).toHaveCount(0);
  await tile.locator('.p-name').click();
  const menu = page.getByRole('menu', { name: 'Лира', exact: true });
  await expect(menu.getByRole('menuitem', { name: 'Выбрать на карте', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
  await tile.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await startDrag(page, tile, await mapPoint(page, 4.5, 4.5));
  await page.mouse.up();
  await expect.poll(async () => (await saved(page)).some(t => t.ref === '41')).toBe(true);
  await expect(menu).not.toBeVisible();
});
