import { test, expect } from "@playwright/test";
import { dragTile, mapPoint } from "./editorHelpers";

async function ready(page, mode, mobile = false) {
  await page.setViewportSize(
    mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
  );
  await page.goto(`/tests/maps/fixtures/maps.html?mode=${mode}&areaExample`);
  await expect(page.locator(".map-canvas-surface > canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
}
for (const mode of ["editor", "board"])
  for (const mobile of [false, true]) {
    test(`opaque panels overlay a fixed WebGL canvas beside the tab rail (${mode}, ${mobile})`, async ({
      page,
    }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await ready(page, mode, mobile);
      await page.getByRole("button", { name: "Области", exact: true }).click();
      await page
        .getByRole("region", { name: "Области карты" })
        .getByRole("button", { name: "Зал", exact: true })
        .click();
      const focus = page.getByRole("complementary", {
        name: "Выбранные элементы",
      });
      await expect(focus).toBeVisible();
      const layout = await page.evaluate(() => {
        const canvas = document.querySelector(".map-canvas-surface > canvas"),
          bounds = canvas.getBoundingClientRect(),
          workspace = document
            .querySelector(".map-editor")
            .getBoundingClientRect();
        const alpha = (element) => {
          const context = new OffscreenCanvas(1, 1).getContext("2d");
          context.fillStyle = getComputedStyle(element).backgroundColor;
          context.fillRect(0, 0, 1, 1);
          return context.getImageData(0, 0, 1, 1).data[3];
        };
        const panel = document.querySelector(".map-sidebar-panel"),
          inspector = document.querySelector(".workspace-focus-content"),
          rail = document.querySelector(".map-sidebar-tabs");
        return {
          canvas: bounds.toJSON(),
          sidebar: document.querySelector(".map-sidebar").getBoundingClientRect().toJSON(),
          workspace: workspace.toJSON(),
          panel: alpha(panel),
          inspector: alpha(inspector),
          rail: alpha(rail),
          railBounds: rail.getBoundingClientRect().toJSON(),
          blur: [panel, inspector, rail].map(
            (node) => getComputedStyle(node).backdropFilter,
          ),
        };
      });
      expect(layout.canvas.x).toBeCloseTo(layout.railBounds.right, 0);
      expect(layout.canvas.y).toBe(layout.workspace.y);
      expect(layout.canvas.width).toBeCloseTo(
        layout.workspace.width - layout.railBounds.width,
      );
      expect(layout.canvas.height).toBeCloseTo(layout.workspace.height, 0);
      expect([layout.panel, layout.inspector, layout.rail]).toEqual([
        255, 255, 255,
      ]);
      expect(layout.blur).toEqual(["none", "none", "none"]);
      const expectHintOutsidePanel = async () => {
        const bounds = await page.locator(".map-controls-hint").boundingBox();
        const sidebar = await page.locator(".map-sidebar").boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width);
      };
      await expectHintOutsidePanel();
      await page.evaluate(() => {
        const canvas = document.querySelector(".map-canvas-surface > canvas");
        window.canvasTracking = {
          canvas,
          context: canvas.getContext("webgl2"),
          mutations: [],
          lost: false,
          coveredHint: false,
        };
        const trackHint = () => {
          const hint = document
            .querySelector(".map-controls-hint")
            .getBoundingClientRect();
          const rail = document
            .querySelector(".map-sidebar-tabs")
            .getBoundingClientRect();
          if (hint.left < rail.right - 0.5)
            window.canvasTracking.coveredHint = true;
          window.hintFrame = requestAnimationFrame(trackHint);
        };
        trackHint();
        window.canvasObserver = new MutationObserver((entries) =>
          window.canvasTracking.mutations.push(
            ...entries.map((entry) => entry.attributeName),
          ),
        );
        window.canvasObserver.observe(canvas, {
          attributes: true,
          attributeFilter: ["width", "height"],
        });
        canvas.addEventListener("webglcontextlost", () => {
          window.canvasTracking.lost = true;
        });
      });
      for (let i = 0; i < 2; i++) {
        await page
          .getByRole("button", { name: "Свернуть панель карты", exact: true })
          .click();
        await expect
          .poll(
            async () =>
              (await page.locator(".map-sidebar").boundingBox()).width,
          )
          .toBeCloseTo(layout.railBounds.width, 0);
        await expectHintOutsidePanel();
        await page
          .getByRole("button", { name: "Области", exact: true })
          .click();
        await expect
          .poll(
            async () =>
              (await page.locator(".map-sidebar").boundingBox()).width,
          )
          .toBeCloseTo(layout.sidebar.width, 0);
        await expectHintOutsidePanel();
      }
      const stability = await page.evaluate(() => {
        window.canvasObserver.disconnect();
        cancelAnimationFrame(window.hintFrame);
        const state = window.canvasTracking,
          canvas = document.querySelector(".map-canvas-surface > canvas");
        return {
          sameCanvas: canvas === state.canvas,
          sameContext: canvas.getContext("webgl2") === state.context,
          mutations: state.mutations,
          lost: state.lost,
          coveredHint: state.coveredHint,
          bounds: canvas.getBoundingClientRect().toJSON(),
        };
      });
      expect(stability.sameCanvas).toBe(true);
      expect(stability.sameContext).toBe(true);
      expect(stability.mutations).toEqual([]);
      expect(stability.lost).toBe(false);
      expect(stability.coveredHint).toBe(false);
      expect(stability.bounds).toEqual(layout.canvas);
      expect(errors).toEqual([]);
    });
  }

test("releasing a catalogue drag over either overlay never places a model behind the panel", async ({
  page,
}) => {
  await ready(page, "editor");
  const count = () =>
    page.evaluate(
      () => (window.lastSaved || window.templateMap).document.tiles.length,
    );
  const before = await count(),
    card = page.getByRole("button", { name: "Пол 1", exact: true });
  const source = await card.boundingBox();
  await page.mouse.move(source.x + 20, source.y + 20);
  await page.mouse.down();
  await page.mouse.move(source.x + 24, source.y + 24);
  await page.mouse.up();
  expect(await count()).toBe(before);
  await page.getByTitle("Вид сверху", { exact: true }).click();
  await dragTile(page, await mapPoint(page, 7.5, 5.5));
  await expect.poll(count).toBe(before + 1);
  const inspector = await page
    .getByRole("complementary", { name: "Выбранные элементы" })
    .boundingBox();
  await page.mouse.move(source.x + 20, source.y + 20);
  await page.mouse.down();
  await page.mouse.move(inspector.x + 30, inspector.y + 50, { steps: 10 });
  await page.mouse.up();
  expect(await count()).toBe(before + 1);
});
