import { test, expect } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
    test(`glass panels overlay a fixed WebGL canvas without resizing its buffers (${mode}, ${mobile})`, async ({
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
      const glass = await page.evaluate(() => {
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
          inspector = document.querySelector(".map-selection-panel"),
          rail = document.querySelector(".map-sidebar-tabs");
        return {
          canvas: bounds.toJSON(),
          workspace: workspace.toJSON(),
          panel: alpha(panel),
          inspector: alpha(inspector),
          rail: alpha(rail),
          blur: [panel, inspector, rail].map(
            (node) => getComputedStyle(node).backdropFilter,
          ),
        };
      });
      expect(glass.canvas).toEqual(glass.workspace);
      for (const alpha of [glass.panel, glass.inspector]) {
        expect(alpha).toBeGreaterThan(0);
        expect(alpha).toBeLessThan(255);
      }
      expect(glass.rail).toBe(255);
      expect(glass.blur[0]).toContain("blur(24px)");
      expect(glass.blur[1]).toContain("blur(24px)");
      expect(glass.blur[2]).toBe("none");
      await page.evaluate(() => {
        const canvas = document.querySelector(".map-canvas-surface > canvas");
        window.canvasTracking = {
          canvas,
          context: canvas.getContext("webgl2"),
          mutations: [],
          lost: false,
        };
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
          .toBe(60);
        await page
          .getByRole("button", { name: "Области", exact: true })
          .click();
        await expect
          .poll(
            async () =>
              (await page.locator(".map-sidebar").boundingBox()).width,
          )
          .toBe(mobile ? 330 : 334);
      }
      const stability = await page.evaluate(() => {
        window.canvasObserver.disconnect();
        const state = window.canvasTracking,
          canvas = document.querySelector(".map-canvas-surface > canvas");
        return {
          sameCanvas: canvas === state.canvas,
          sameContext: canvas.getContext("webgl2") === state.context,
          mutations: state.mutations,
          lost: state.lost,
          bounds: canvas.getBoundingClientRect().toJSON(),
        };
      });
      expect(stability.sameCanvas).toBe(true);
      expect(stability.sameContext).toBe(true);
      expect(stability.mutations).toEqual([]);
      expect(stability.lost).toBe(false);
      expect(stability.bounds).toEqual(glass.canvas);
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

test("production glass blurs the scene behind both panels", async ({
  page,
}) => {
  const assets = new URL("../../target/dist/static/", import.meta.url);
  test.skip(!existsSync(assets), "Run the production build first");
  const css = readdirSync(assets)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(new URL(name, assets), "utf8"))
    .filter((source) => source.includes("map-glass-panel"))
    .join("\n");
  expect(css).toContain("map-glass-panel");
  await ready(page, "editor");
  await page.getByRole("button", { name: "Области", exact: true }).click();
  await page.getByRole("button", { name: "Зал", exact: true }).click();
  await page.evaluate(async (css) => {
    for (const node of document.querySelectorAll(
      'style[data-vite-dev-id*="mapGlass.css"]',
    ))
      node.remove();
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    const style = document.createElement("style");
    style.textContent = [...sheet.cssRules]
      .filter((rule) => rule.cssText.includes("map-glass-panel"))
      .map((rule) => rule.cssText)
      .join("\n");
    document.head.append(style);
    const stripes = document.createElement("div");
    stripes.style.cssText =
      "position:absolute;inset:0;z-index:1;pointer-events:none;background:repeating-linear-gradient(90deg,white 0 4px,black 4px 8px)";
    document.querySelector(".map-editor-main").append(stripes);
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished),
    );
    for (const panel of document.querySelectorAll(".map-glass-panel"))
      for (const child of panel.children) child.style.visibility = "hidden";
  }, css);
  const contrast = async (clip) => {
    const frame = await page.screenshot({ clip });
    return page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (character) =>
        character.charCodeAt(0),
      );
      const bitmap = await createImageBitmap(
        new Blob([bytes], { type: "image/png" }),
      );
      const context = new OffscreenCanvas(
        bitmap.width,
        bitmap.height,
      ).getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      let sum = 0;
      for (let y = 0; y < bitmap.height; y++)
        for (let x = 1; x < bitmap.width; x++) {
          const index = (y * bitmap.width + x) * 4;
          sum += Math.abs(data[index] - data[index - 4]);
        }
      return sum / ((bitmap.width - 1) * bitmap.height);
    }, frame.toString("base64"));
  };
  for (const panel of [".map-sidebar-panel", ".map-selection-panel"]) {
    const bounds = await page.locator(panel).boundingBox();
    const clip = { x: bounds.x + 20, y: bounds.y + 40, width: 100, height: 40 };
    const blurred = await contrast(clip);
    await page.locator(panel).evaluate((element) => {
      element.style.backdropFilter = "none";
      element.style.webkitBackdropFilter = "none";
    });
    const sharp = await contrast(clip);
    expect(sharp).toBeGreaterThan(5);
    expect(blurred).toBeLessThan(sharp * 0.2);
  }
});
