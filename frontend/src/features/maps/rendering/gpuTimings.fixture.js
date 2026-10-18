import { expect, vi } from "vitest";
export function fakeGpu() {
  const queries = [];
  let active = null;
  const gl = {
    QUERY_RESULT_AVAILABLE: 1,
    QUERY_RESULT: 2,
    disjoint: false,
    getExtension: () => ({
      TIME_ELAPSED_EXT: 3,
      GPU_DISJOINT_EXT: 4,
      QUERY_COUNTER_BITS_EXT: 5,
    }),
    getQuery: () => 64,
    isContextLost: () => false,
    getParameter: () => gl.disjoint,
    createQuery: () => {
      const q = { ready: false, deleted: false };
      queries.push(q);
      return q;
    },
    beginQuery: (_target, q) => {
      expect(active).toBe(null);
      active = q;
    },
    endQuery: () => {
      expect(active).not.toBe(null);
      active = null;
    },
    deleteQuery: (q) => {
      q.deleted = true;
    },
    getQueryParameter: (q, field) => (field === 1 ? q.ready : 1e6),
  };
  const gpu = {
    getContext: vi.fn(() => gl),
    info: {
      autoReset: true,
      render: { calls: 0, triangles: 0 },
      reset() {
        this.render = { calls: 0, triangles: 0 };
      },
    },
    render(scene) {
      for (const d of scene.draws || [])
        this.renderBufferDirect(
          null,
          scene,
          null,
          d.material || {},
          d.object,
          null,
        );
    },
    renderBufferDirect() {
      this.info.render.calls++;
      this.info.render.triangles += 12;
    },
  };
  return { gpu, gl, queries };
}
