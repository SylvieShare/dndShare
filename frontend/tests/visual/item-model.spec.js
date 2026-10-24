import { test, expect } from "@playwright/test";
import { itemModelFixture } from "./itemModelFixture";

const toggle = (page) =>
  page.getByRole("button", { name: "3D-модель", exact: true });
const canvasHost = (page) => page.locator(".item-model-canvas");
async function expectFullCoverHeight(page) {
  const cover = await page.locator(".item-detail-header-model").boundingBox();
  const canvas = await canvasHost(page).boundingBox();
  expect(Math.abs(canvas.y - cover.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(canvas.height - cover.height)).toBeLessThanOrEqual(1);
}
async function open(page, typeId = 6) {
  await page.goto(`/handbook?type=${typeId}&item=1`);
  await expect(page.locator(".handbook-detail h1")).toHaveText("Кобольд");
}

for (const typeId of [6, 2])
  test(`3D replaces the cover only on demand for item type ${typeId}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const requests = await itemModelFixture(page, { typeId });
    await open(page, typeId);
    await expect(page.locator(".item-detail-cover")).toBeVisible();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
    const button = await toggle(page).boundingBox(),
      source = await page.locator(".item-detail-source").boundingBox();
    expect(button.x + button.width).toBeLessThanOrEqual(source.x);
    expect(requests.metadata).toBe(0);
    expect(requests.files).toBe(0);
    expect(requests.catalogues).toBe(0);
    await toggle(page).click();
    await expect(canvasHost(page)).toHaveAttribute("data-model-ready", "true");
    await expect(canvasHost(page)).toHaveAttribute("data-model-zoom", "1");
    await expect(page.locator(".item-detail-cover")).toHaveCount(0);
    await expectFullCoverHeight(page);
    const host = canvasHost(page),
      before = await host.locator("canvas").screenshot(),
      yaw = await host.getAttribute("data-model-yaw");
    const box = await host.boundingBox();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(host).not.toHaveAttribute("data-model-yaw", yaw);
    expect((await host.locator("canvas").screenshot()).equals(before)).toBe(
      false,
    );
    const zoom = Number(await host.getAttribute("data-model-zoom"));
    await host.hover();
    await page.mouse.wheel(0, -200);
    await expect
      .poll(async () => Number(await host.getAttribute("data-model-zoom")))
      .toBeGreaterThan(zoom);
    await host.focus();
    const rotated = await host.getAttribute("data-model-yaw");
    await page.keyboard.press("ArrowLeft");
    await expect(host).not.toHaveAttribute("data-model-yaw", rotated);
    await toggle(page).click();
    await expect(page.locator(".item-detail-cover")).toBeVisible();
    await expect(page.locator(".item-model-preview")).toHaveCount(0);
    expect(requests.metadata).toBe(1);
    expect(requests.files).toBe(2);
    expect(requests.catalogues).toBe(0);
    expect(errors).toEqual([]);
  });

test("items without models omit the switch and make no model requests", async ({
  page,
}) => {
  const requests = await itemModelFixture(page, { hasModel: false });
  await open(page);
  await expect(toggle(page)).toHaveCount(0);
  expect(requests.metadata).toBe(0);
  expect(requests.files).toBe(0);
});

test("failed model loads can be retried, and changing the item restores its cover", async ({
  page,
}) => {
  const requests = await itemModelFixture(page, { fail: true });
  await open(page);
  await toggle(page).click();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось загрузить 3D-модель",
  );
  requests.fail = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(canvasHost(page)).toHaveAttribute("data-model-ready", "true");
  await page
    .locator(".handbook-list .list-row")
    .filter({ hasText: "Без модели" })
    .click();
  await expect(page.locator(".handbook-detail h1")).toHaveText("Без модели");
  await expect(toggle(page)).toHaveCount(0);
  await expect(page.locator(".item-model-preview")).toHaveCount(0);
  await expect(page.locator(".item-detail-cover")).toBeVisible();
});

test("closing a pending viewer does not attach a late model to the cover", async ({
  page,
}) => {
  const requests = await itemModelFixture(page, { slow: true });
  await open(page);
  await toggle(page).click();
  await expect.poll(() => requests.metadata).toBe(1);
  await toggle(page).click();
  requests.release();
  await expect(page.locator(".item-model-preview")).toHaveCount(0);
  await expect(page.locator(".item-detail-cover")).toBeVisible();
  expect(requests.files).toBe(0);
});

test.describe("touch 3D preview", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("one finger rotates and two fingers zoom without navigating back", async ({
    page,
  }) => {
    await itemModelFixture(page);
    await open(page);
    await toggle(page).click();
    const host = canvasHost(page);
    await expect(host).toHaveAttribute("data-model-ready", "true");
    await expect(host).toHaveAttribute("data-model-zoom", "1");
    await expectFullCoverHeight(page);
    const b = await host.boundingBox();
    expect(b.width).toBeGreaterThan(300);
    expect(b.height).toBeGreaterThan(200);
    const cdp = await page.context().newCDPSession(page);
    const x = b.x + b.width / 2,
      y = b.y + b.height / 2,
      yaw = await host.getAttribute("data-model-yaw");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: x - 50, y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 60, y: y + 10 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(host).not.toHaveAttribute("data-model-yaw", yaw);
    await expect(page).toHaveURL(/item=1/);
    const zoom = Number(await host.getAttribute("data-model-zoom"));
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: x - 35, y },
        { x: x + 35, y },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - 65, y },
        { x: x + 65, y },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () => Number(await host.getAttribute("data-model-zoom")))
      .toBeGreaterThan(zoom);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });
});
