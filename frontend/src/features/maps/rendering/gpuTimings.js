// Non-overlapping elapsed queries, sampled asynchronously without gl.finish().
export function createGpuTimings(gpu, classify) {
  const gl = gpu.getContext(),
    ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "";
  // ANGLE Metal flushes a command buffer at each timer boundary. Per-draw
  // segments heavily perturb tile-based rendering; use one asynchronous query.
  const granularity = /Metal/i.test(String(renderer)) ? "frame" : "parts";
  let frame,
    segment,
    queries = [],
    pending = [],
    restore;
  const supported =
    !!ext && gl.getQuery(ext.TIME_ELAPSED_EXT, ext.QUERY_COUNTER_BITS_EXT) > 0;
  function close() {
    if (!segment) return;
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    queries.push(segment);
    segment = null;
  }
  function discard(items) {
    for (const item of items) gl.deleteQuery(item.query);
  }
  function phase(category) {
    if (!frame || frame.overflow || segment?.category === category) return;
    close();
    if (queries.length >= 96) {
      frame.overflow = true;
      return;
    }
    const query = gl.createQuery();
    if (!query) {
      frame.overflow = true;
      return;
    }
    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    segment = { category, query };
  }
  function poll() {
    if (!supported || frame) return;
    if (gl.isContextLost() || gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      for (const entry of pending) discard(entry.queries);
      pending = [];
      return;
    }
    pending = pending.filter((entry) => {
      if (
        !entry.queries.every((q) =>
          gl.getQueryParameter(q.query, gl.QUERY_RESULT_AVAILABLE),
        )
      )
        return true;
      const parts = {};
      for (const q of entry.queries) {
        const ms = gl.getQueryParameter(q.query, gl.QUERY_RESULT) / 1e6;
        parts[q.category] = (parts[q.category] || 0) + ms;
      }
      discard(entry.queries);
      if (Object.values(parts).every((n) => Number.isFinite(n) && n >= 0))
        entry.accept(parts);
      return false;
    });
  }
  return {
    supported,
    granularity,
    start() {
      if (!supported || restore) return;
      if (granularity === "frame") {
        restore = () => {};
        return;
      }
      const render = gpu.render,
        draw = gpu.renderBufferDirect,
        blit = gl.blitFramebuffer;
      let depth = 0,
        pass;
      const wrappedRender = function (...args) {
        const previousPass = pass;
        pass = args[0]?.userData?.renderCategory || "presentation";
        if (frame) {
          depth++;
          phase(args[0]?.userData?.renderCategory || "other");
        }
        try {
          return render.apply(this, args);
        } finally {
          if (frame && --depth === 0) close();
          pass = previousPass;
        }
      };
      const wrappedDraw = function (...args) {
        if (frame) phase(classify(args[4], args[3], args[1]));
        return draw.apply(this, args);
      };
      gpu.render = wrappedRender;
      gpu.renderBufferDirect = wrappedDraw;
      const wrappedBlit =
        typeof blit === "function"
          ? function (...args) {
              if (frame) phase(pass || "presentation");
              return blit.apply(gl, args);
            }
          : null;
      if (wrappedBlit) gl.blitFramebuffer = wrappedBlit;
      restore = () => {
        if (gpu.render === wrappedRender) gpu.render = render;
        if (gpu.renderBufferDirect === wrappedDraw)
          gpu.renderBufferDirect = draw;
        if (wrappedBlit && gl.blitFramebuffer === wrappedBlit)
          gl.blitFramebuffer = blit;
      };
    },
    begin(accept) {
      poll();
      if (
        !supported ||
        pending.length >= 8 ||
        gl.isContextLost() ||
        gl.getParameter(ext.GPU_DISJOINT_EXT)
      )
        return;
      frame = { accept, overflow: false };
      queries = [];
      if (granularity === "frame") phase("frame");
    },
    end() {
      if (!frame) return;
      close();
      if (frame.overflow || !queries.length) discard(queries);
      else pending.push({ queries, accept: frame.accept });
      frame = null;
      queries = [];
    },
    poll,
    stop() {
      close();
      discard(queries);
      for (const entry of pending) discard(entry.queries);
      frame = null;
      queries = [];
      pending = [];
      restore?.();
      restore = null;
    },
  };
}
