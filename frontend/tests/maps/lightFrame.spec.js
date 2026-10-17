import { test, expect } from "@playwright/test";
import { mapPoint } from "./editorHelpers";
const selection = (page) =>
  page.getByRole("complementary", { name: "Выбранные элементы", exact: true });
async function ready(page, extra) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tests/maps/fixtures/maps.html?mode=editor${extra}`);
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
}
async function hash(canvas) {
  return canvas.evaluate((el) => {
    const pixels = el
      .getContext("2d")
      .getImageData(0, 0, el.width, el.height).data;
    let hash = 2166136261;
    for (const pixel of pixels) hash = Math.imul(hash ^ pixel, 16777619) >>> 0;
    return hash;
  });
}
test("light preview copies a centred framebuffer, freezes off-screen, and resumes after focusing beside the inspector", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page, "&lightExample&lit");
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  const row = page
    .getByRole("region", { name: "Освещение карты" })
    .getByRole("button", { name: "Факел", exact: true });
  await row.click();
  const panel = selection(page),
    preview = panel.locator(".map-light-preview"),
    output = preview.locator("canvas");
  await expect(preview).toHaveAttribute("data-preview-state", "live");
  expect(await output.evaluate((el) => el.width)).toBeGreaterThan(100);
  expect(await output.evaluate((el) => el.height)).toBeGreaterThan(100);
  await expect
    .poll(() =>
      output.evaluate((el) => {
        const p = el
          .getContext("2d")
          .getImageData(
            Math.floor(el.width / 2),
            Math.floor(el.height / 2),
            1,
            1,
          ).data;
        return p[0] > 180 && p[1] > 50 && p[1] < 210 && p[2] < 130;
      }),
    )
    .toBe(true);
  await row.dblclick();
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.down("ArrowRight");
  await expect(preview).toHaveAttribute("data-preview-state", "outside", {
    timeout: 10000,
  });
  await page.keyboard.up("ArrowRight");
  await expect(preview).toContainText("Последний кадр");
  const frozen = await hash(output);
  await page.getByRole("button", { name: "Увеличить", exact: true }).click();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  expect(await hash(output)).toBe(frozen);
  await panel
    .getByRole("button", { name: "Приблизить источник: Факел", exact: true })
    .dblclick();
  await expect(preview).toHaveAttribute("data-preview-state", "live");
  expect(errors).toEqual([]);
});
test("transition heading spacing matches other inspector sections", async ({
  page,
}) => {
  await ready(page, "&transitions");
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const point = await mapPoint(page, 4.5, 4.5);
  await page.mouse.click(point.x, point.y);
  const panel = selection(page);
  const gaps = [];
  for (const name of ["Переходы модели", "Область"]) {
    const section = panel.getByRole("region", { name, exact: true });
    await section.scrollIntoViewIfNeeded();
    const heading = await section.locator(".share-section-label").boundingBox();
    const body = await section
      .locator(".map-inspector-section-body")
      .boundingBox();
    gaps.push(body.y - heading.y - heading.height);
  }
  expect(gaps[0]).toBeCloseTo(12, 0);
  expect(gaps[0]).toBeCloseTo(gaps[1], 1);
});
for (const reduced of [false, true])
  test(`help has no expanded header and animates size unless motion is reduced (${reduced})`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await ready(page, "");
    const hint = page.locator(".map-controls-hint"),
      commands = page.getByRole("list", { name: "Команды управления картой" });
    await expect(commands).toBeVisible();
    await expect(hint.getByRole("button")).toHaveCount(0);
    const before = await hint.boundingBox();
    const animated = await commands.evaluate(async (el) => {
      const frame = el.closest(".map-controls-hint");
      el.click();
      await new Promise(requestAnimationFrame);
      return frame
        .getAnimations()
        .some((a) => a.effect.getKeyframes().some((k) => k.height));
    });
    expect(animated).toBe(!reduced);
    const button = page.getByRole("button", {
      name: "Управление картой",
      exact: true,
    });
    await expect(button).toBeVisible();
    await expect
      .poll(() =>
        hint.evaluate(
          (el) =>
            el.getAnimations().filter((a) => a.playState === "running").length,
        ),
      )
      .toBe(0);
    expect((await hint.boundingBox()).height).toBeLessThan(before.height);
    await button.press("Enter");
    await expect(commands).toBeFocused();
    await expect(hint.getByRole("button")).toHaveCount(0);
    await commands.press("Space");
    await expect(button).toBeFocused();
  });
