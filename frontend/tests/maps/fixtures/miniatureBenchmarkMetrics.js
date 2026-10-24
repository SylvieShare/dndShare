export async function benchmarkMetrics(page, frames = 80) {
  return page.evaluate(async (frames) => {
    const gl = document.querySelector("canvas").getContext("webgl2"),
      extension = gl.getExtension("WEBGL_debug_renderer_info");
    const intervals = [];
    // Diagnostic only: drain preceding work, then include GPU completion.
    // rAF can continue at 60 Hz while headless Chrome queues slower GPU work.
    const pixel = new Uint8Array(4);
    const complete = () => {
      gl.finish();
      gl.readPixels(
        Math.floor(gl.drawingBufferWidth / 2),
        Math.floor(gl.drawingBufferHeight / 2),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
    };
    complete();
    for (let i = 0; i < frames; i++) {
      const start = performance.now();
      window.benchmark.rotate(Math.sin(i * 0.15) * 8);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      complete();
      intervals.push(performance.now() - start);
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    const sample = structuredClone(window.benchmark.sample),
      draws = window.benchmarkDraws;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const sorted = intervals.slice(3).sort((a, b) => a - b);
    return {
      renderer: extension
        ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      frameMedianMs: sorted[Math.floor(sorted.length * 0.5)],
      frameP95Ms: sorted[Math.floor(sorted.length * 0.95)],
      frames,
      gpuCompletionWait: true,
      readbackError: gl.getError(),
      sample,
      errors: window.benchmark.errors,
      idleDraws: window.benchmarkDraws - draws,
      progress: window.benchmark.progress,
    };
  }, frames);
}
