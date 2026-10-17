import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";
const panelOf = (page) =>
  page.getByRole("complementary", { name: "Выбранные элементы" });
async function ready(page, extra = "") {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=editor${extra}`);
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
}
test("focus scrolls inside its frame, retains the heading, and uses compact muted light controls without title dividers", async ({
  page,
}) => {
  await ready(page, "&transitions");
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  const list = page.getByRole("region", { name: "Освещение карты" });
  const row = list.getByRole("button", {
    name: "Стена 1 · Прикреплённая лампа",
    exact: true,
  });
  await row.click();
  const panel = panelOf(page),
    body = panel.locator(".map-focus-body");
  await expect(body).toHaveCSS("overflow-y", "auto");
  await expect(panel).toHaveCSS("overflow-y", "hidden");
  await expect(body).toHaveCSS("gap", "20px");
  await expect(panel.locator(".map-selected-heading")).toHaveCSS(
    "border-top-width",
    "0px",
  );
  await expect(panel.locator(".share-section-label").first()).toHaveCSS(
    "margin-bottom",
    "12px",
  );
  await expect(panel.locator(".share-section-label").first()).toHaveCSS(
    "border-top-width",
    "0px",
  );
  expect(await body.evaluate((el) => el.scrollHeight)).toBeGreaterThan(
    await body.evaluate((el) => el.clientHeight),
  );
  const heading = panel.locator(".map-focus-heading"),
    before = await heading.boundingBox();
  await body.evaluate((el) => (el.scrollTop = el.scrollHeight));
  expect((await heading.boundingBox()).y).toBe(before.y);
  expect(await panel.evaluate((el) => el.scrollTop)).toBe(0);
  const trash = panel
    .getByRole("button", { name: "Удалить элемент", exact: true })
    .locator("svg");
  const red = await trash.evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--danger)";
    el.append(probe);
    const wanted = getComputedStyle(probe).color;
    probe.remove();
    return { wanted, actual: getComputedStyle(el).color };
  });
  expect(red.actual).toBe(red.wanted);
  const prefix = row.locator(".map-entity-prefix");
  expect(await prefix.evaluate((el) => getComputedStyle(el).color)).not.toBe(
    await row.locator("strong").evaluate((el) => getComputedStyle(el).color),
  );
  const button = row.getByRole("button", {
    name: "Выключить свет: Стена 1 · Прикреплённая лампа",
    exact: true,
  });
  await expect(button).toHaveCSS("width", "40px");
  await expect(button).toHaveCSS("height", "40px");
  expect(
    await button.locator(".share-icon-toggle__slash path").getAttribute("d"),
  ).toBe("M2 2 22 22");
  const power = row.locator(".share-icon-toggle").first();
  await power.click();
  await expect(power.locator(".share-icon-toggle__icon")).toHaveCSS(
    "opacity",
    "0.4",
  );
  await power.click();
  await expect(power.locator(".share-icon-toggle__icon")).toHaveCSS(
    "opacity",
    "1",
  );
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const p = await mapPoint(page, 4.5, 4.5);
  await page.mouse.click(p.x, p.y);
  const attached = panelOf(page).getByRole("region", {
    name: "Прикреплённый свет",
    exact: true,
  });
  const tile = attached.getByRole("button", {
    name: "Стена 1 · Прикреплённая лампа",
    exact: true,
  });
  const detach = attached.getByRole("button", {
    name: "Отвязать Стена 1 · Прикреплённая лампа",
    exact: true,
  });
  await detach.scrollIntoViewIfNeeded();
  expect(await tile.locator("button").count()).toBe(2);
  const tileBox = await tile.boundingBox(),
    detachBox = await detach.boundingBox();
  expect(detachBox.x).toBeGreaterThanOrEqual(tileBox.x + tileBox.width);
});
for (const modifier of ["Meta", "Control"])
  test(`command stamping keeps tile paste active until a plain click (${modifier})`, async ({
    page,
  }) => {
    await ready(page);
    await page.getByTitle("Вид сверху", { exact: true }).click();
    await dragTile(page, await mapPoint(page, 3.5, 3.5));
    await page.keyboard.press("Control+c");
    let p = await mapPoint(page, 6.5, 4.5);
    await page.mouse.move(p.x, p.y);
    await page.keyboard.press("Control+v");
    await page.keyboard.down(modifier);
    for (const x of [6.5, 7.5]) {
      p = await mapPoint(page, x, 4.5);
      await page.mouse.click(p.x, p.y);
    }
    await page.keyboard.up(modifier);
    p = await mapPoint(page, 8.5, 4.5);
    await page.mouse.click(p.x, p.y);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.lastSaved?.document.tiles
            .filter((t) => t.modelId.startsWith("2222"))
            .map((t) => [t.x, t.y])
            .sort((a, b) => a[0] - b[0]),
        ),
      )
      .toEqual([
        [3, 3],
        [6, 4],
        [7, 4],
        [8, 4],
      ]);
    p = await mapPoint(page, 5.5, 4.5);
    await page.mouse.click(p.x, p.y);
    expect(
      await page.evaluate(
        () =>
          window.lastSaved?.document.tiles.filter((t) =>
            t.modelId.startsWith("2222"),
          ).length,
      ),
    ).toBe(4);
  });
test("copied light also stays attached to the pointer after a command stamp", async ({
  page,
}) => {
  await ready(page, "&lightExample&lit");
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  await page
    .getByRole("region", { name: "Освещение карты" })
    .getByRole("button", { name: "Факел", exact: true })
    .click();
  await page.keyboard.press("Control+c");
  let p = await mapPoint(page, 6.5, 4.5);
  await page.mouse.move(p.x, p.y);
  await page.keyboard.press("Control+v");
  await page.keyboard.down("Meta");
  await page.mouse.click(p.x, p.y);
  await page.keyboard.up("Meta");
  p = await mapPoint(page, 8.5, 4.5);
  await page.mouse.click(p.x, p.y);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.lights.length))
    .toBe(3);
  expect(
    await page.evaluate(
      () => new Set(window.lastSaved.document.lights.map((l) => l.id)).size,
    ),
  ).toBe(3);
});
