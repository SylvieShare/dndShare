// Subscribers may mount before asynchronous WebGL initialization finishes.
export function createPerformanceBridge() {
  let renderer, stop;
  const observers = new Set();
  function connect() {
    stop?.();
    stop = null;
    if (renderer && observers.size)
      stop = renderer.observePerformance((value) => {
        for (const listener of observers) listener(value);
      });
  }
  return {
    attach(next) {
      renderer = next;
      connect();
    },
    observe(listener) {
      observers.add(listener);
      connect();
      return () => {
        observers.delete(listener);
        if (!observers.size) {
          stop?.();
          stop = null;
        }
      };
    },
    destroy() {
      stop?.();
      stop = null;
      renderer = null;
      observers.clear();
    },
  };
}
