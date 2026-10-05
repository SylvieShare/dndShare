import { test, expect } from "@playwright/test";
import { mapPoint, pickTile } from "./editorHelpers";
async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page.getByTitle("Вид сверху", { exact: true }).click();
}

test("wall brush previews corners and commits one connected stroke", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("toolbar", { name: "Действия карты" })
    .getByRole("button", { name: "Кисть стенами", exact: true })
    .click();
  const first = await mapPoint(page, 4.5, 3.5),
    corner = await mapPoint(page, 5.5, 3.5),
    end = await mapPoint(page, 5.5, 4.5);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  await page.mouse.move(corner.x, corner.y, { steps: 6 });
  await page.mouse.move(end.x, end.y, { steps: 6 });
  expect(await page.evaluate(() => window.requests)).toEqual([]);
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) => t.x === 5 && t.y === 3)
            ?.modelId,
      ),
    )
    .toBe("33333333-3333-4333-8333-333333333333");
  expect(
    await page.evaluate(
      () =>
        window.lastSaved.document.tiles.find((t) => t.x === 5 && t.y === 3)
          .rotation,
    ),
  ).toBe(270);
  await page.getByTitle("Отменить · Ctrl/Cmd+Z").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.filter(
            (t) =>
              (t.x === 4 && t.y === 3) || (t.x === 5 && [3, 4].includes(t.y)),
          ).length,
      ),
    )
    .toBe(0);
});

test("command tile drag previews and fills a bounded room on release", async ({
  page,
}) => {
  await ready(page);
  const point = await mapPoint(page, 4.5, 4.5);
  const before = await page.locator(".map-canvas canvas").screenshot();
  await pickTile(page);
  await page.keyboard.down("Meta");
  await page.mouse.move(point.x, point.y, { steps: 12 });
  expect(
    (await page.locator(".map-canvas canvas").screenshot()).equals(before),
  ).toBe(false);
  expect(await page.evaluate(() => window.requests)).toEqual([]);
  await page.mouse.click(point.x, point.y);
  await page.keyboard.up("Meta");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.filter((t) =>
            t.modelId.startsWith("2222"),
          ).length,
      ),
    )
    .toBe(48);
});

test("unbounded command drops do not fill the map and camera controls stay at the right", async ({
  page,
}) => {
  await ready(page);
  const point = await mapPoint(page, 0.5, 0.5);
  await pickTile(page);
  await page.keyboard.down("Meta");
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.mouse.click(point.x, point.y);
  await page.keyboard.up("Meta");
  await expect(page.getByRole("alert")).toContainText("не замкнута");
  expect(await page.evaluate(() => window.requests)).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Повернуть обзор на 90°" }),
  ).toHaveCount(0);
  const host = await page.locator(".map-canvas").boundingBox(),
    controls = await page.locator(".map-canvas-controls").boundingBox(),
    hint = await page.locator(".map-controls-hint").boundingBox();
  expect(controls.x + controls.width).toBeCloseTo(host.x + host.width - 16, 0);
  expect(hint.x).toBeCloseTo(host.x + 16, 0);
  expect(hint.y + hint.height).toBeCloseTo(host.y + host.height - 16, 0);
});
