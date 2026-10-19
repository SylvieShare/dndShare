import { test, expect } from "@playwright/test";
for (const reduced of [false, true])
  test(`tile replacements reuse the area flash without lighting identical neighbours (${reduced})`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /WebGL|Shader|GL_INVALID/.test(message.text())
      )
        errors.push(message.text());
    });
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/tests/maps/fixtures/maps.html?mode=editor&transitions");
    await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
    await page.getByTitle("Вид сверху", { exact: true }).click();
    await page.evaluate(() => {
      const editor = document.querySelector(".map-editor-workspace")
        .__vueParentComponent.exposed.editor;
      const element = document.querySelector(".map-canvas");
      const controller = element.__vueParentComponent.exposed;
      const canvas = element.querySelector(".map-canvas-surface > canvas"),
        gl = canvas.getContext("webgl2");
      const target = editor.catalogue.find(
        (model) => model.definitionId === "LC-001-OFF",
      );
      editor.change((map) => {
        map.document.tiles.push({
          id: "flash-neighbour",
          modelId: target.id,
          x: 6,
          y: 4,
          rotation: 0,
          level: 0,
        });
        map.document.areas[0].tileIds.push("flash-neighbour");
      });
      function pixel(x, y) {
        const view = controller.getView(),
          bounds = canvas.getBoundingClientRect(),
          data = new Uint8Array(4);
        const px = Math.floor(
          ((bounds.width / 2 + (x - view.x) * view.cellPixels) * canvas.width) /
            bounds.width,
        );
        const py = Math.floor(
          ((bounds.height / 2 + (y - view.y) * view.cellPixels) *
            canvas.height) /
            bounds.height,
        );
        gl.readPixels(
          px,
          canvas.height - py - 1,
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          data,
        );
        return [...data];
      }
      async function sample() {
        controller.setView(controller.getView());
        await new Promise(requestAnimationFrame);
        return { tile: pixel(4.5, 4.5), neighbour: pixel(6.5, 4.5) };
      }
      window.flashProbe = {
        sample,
        replace() {
          const model = editor.catalogue.find(
            (model) => model.id === editor.draft.document.tiles[0].modelId,
          );
          editor.applyTransition(
            "tile",
            "torch-tile",
            model.behaviour.transitions[0],
          );
        },
      };
    });
    await expect
      .poll(async () => {
        const pixels = await page.evaluate(() => window.flashProbe.sample());
        return (
          pixels.tile[0] > pixels.tile[2] + 5 &&
          pixels.neighbour[0] > pixels.neighbour[2] + 5
        );
      })
      .toBe(true);
    const result = await page.evaluate(async () => {
      const before = await window.flashProbe.sample(),
        samples = [];
      window.flashProbe.replace();
      const start = performance.now();
      while (performance.now() - start < 900)
        samples.push(await window.flashProbe.sample());
      return { before, samples, after: samples.at(-1) };
    });
    expect(
      Math.abs(result.before.tile[0] - result.before.neighbour[0]),
    ).toBeLessThan(4);
    expect(
      Math.abs(result.after.tile[0] - result.before.neighbour[0]),
    ).toBeLessThan(4);
    const peak = Math.max(...result.samples.map((sample) => sample.tile[0]));
    if (reduced) expect(peak - result.after.tile[0]).toBeLessThan(4);
    else expect(peak - result.after.tile[0]).toBeGreaterThan(15);
    expect(
      Math.max(
        ...result.samples.map((sample) =>
          Math.abs(sample.neighbour[0] - result.before.neighbour[0]),
        ),
      ),
    ).toBeLessThan(4);
    expect(errors).toEqual([]);
  });
