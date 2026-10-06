import { test, expect } from "@playwright/test";
import { choosePack } from "./editorHelpers";
async function ready(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await page
    .getByRole("tab", { name: "Справочник тайлов", exact: true })
    .click();
  await expect(page.locator(".model-preview-label")).toHaveCount(5);
}
async function clickMarker(page, selector) {
  const marker = page.locator(selector).first();
  await expect(marker).toBeAttached();
  const box = await marker.boundingBox();
  await page.mouse.click(box.x + 1, box.y + 1);
}
async function save(page) {
  await page
    .getByRole("button", { name: "Сохранить параметры", exact: true })
    .click();
  await expect(
    page.getByText("Параметры сохранены · версия 2", { exact: true }),
  ).toBeVisible();
  return page.evaluate(() => window.lastModelSaved);
}
test("icon choices and preview point/side clicks edit the wall mask without rotating on a click", async ({
  page,
}) => {
  await ready(page);
  const catalogue = page.locator(".map-reference-catalogue");
  await catalogue
    .getByRole("button", { name: "Прямые стены", exact: true })
    .click();
  await catalogue.getByRole("button", { name: "Стена 1", exact: true }).click();
  await expect(page.locator("[data-preview-port]")).toHaveCount(8);
  const modes = page.getByRole("toolbar", {
    name: "Расположение стен тайла",
    exact: true,
  });
  await expect(modes.locator("img")).toHaveCount(3);
  const types = page.getByRole("toolbar", { name: "Тип тайла", exact: true });
  await expect(types.getByRole("button")).toHaveCount(13);
  await expect(page.locator("select[aria-label='Тип тайла']")).toHaveCount(0);
  const yaw = await page
    .locator(".model-preview")
    .getAttribute("data-preview-yaw");
  await clickMarker(page, '[data-preview-port="ne"]');
  await expect(
    page.getByRole("button", { name: "Стык: Северо-восток", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.locator(".model-preview").getAttribute("data-preview-yaw"),
  ).toBe(yaw);
  await modes
    .getByRole("button", { name: "По краям клетки", exact: true })
    .click();
  await expect(page.locator("[data-preview-port]")).toHaveCount(4);
  await clickMarker(page, '[data-preview-port="e"]');
  await expect(
    page.getByRole("button", { name: "Стык: Восток", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const canvas = await page.locator(".model-preview-host").boundingBox();
  await page.mouse.move(canvas.x + 30, canvas.y + 30);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 100, canvas.y + 55, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".model-preview")).not.toHaveAttribute(
    "data-preview-yaw",
    yaw,
  );
  const saved = await save(page);
  expect(saved).toMatchObject({
    wallMode: "edge",
    wallMask: 21,
    tileType: "wall-straight",
  });
  expect(
    await page.evaluate(() =>
      window.requests.filter((r) => r.url === "/api/maps/test-map"),
    ),
  ).toEqual([]);
});
test("footprint selection and geometric fields update measurement overlays and preserve exact values", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("gridcell", { name: "3 × 2 клетки", exact: true })
    .click();
  await expect(
    page.getByLabel("Ширина тайла в клетках", { exact: true }),
  ).toHaveValue("3");
  await expect(
    page.getByLabel("Длина тайла в клетках", { exact: true }),
  ).toHaveValue("2");
  for (const [label, value] of [
    ["Высота поверхности", "0.5"],
    ["Глубина монтажного основания", "0.2"],
    ["Полная высота модели", "1.5"],
    ["Смещение модели X", "0.35"],
    ["Смещение модели Z", "-0.25"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await expect(page.locator('[data-preview-field="mountDepth"]')).toContainText(
    "0.2",
  );
  await expect(page.locator('[data-preview-field="offsetZ"]')).toContainText(
    "-0.25",
  );
  const saved = await save(page);
  expect(saved).toMatchObject({
    width: 3,
    height: 2,
    mountDepth: 0.2,
    surfaceHeight: 0.5,
    maxHeight: 1.5,
    placementOffset: [0.35, -0.25],
  });
});
test("support slots appear as per-cell spheres and selecting a sphere highlights its editable card", async ({
  page,
}) => {
  await ready(page);
  await choosePack(page, "ultimate-dungeon");
  const catalogue = page.locator(".map-reference-catalogue");
  await catalogue.getByRole("button", { name: "Каркасы", exact: true }).click();
  await catalogue
    .getByRole("button", { name: "Каркас 2×1", exact: true })
    .click();
  await expect(page.locator('[data-preview-slot="0"]')).toHaveCount(2);
  await clickMarker(page, '[data-preview-slot="0"]');
  await expect(page.locator(".map-model-slot").first()).toHaveClass(
    /base-tile--framed/,
  );
  await page.getByLabel("Паз 1: Высота", { exact: true }).fill("0.55");
  const saved = await save(page);
  expect(saved.supportSlots).toEqual([
    { x: 0, y: 0, width: 2, height: 1, elevation: 0.55 },
  ]);
});
