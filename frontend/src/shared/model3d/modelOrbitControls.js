export function modelOrbitControls(host, view, fit) {
  const pointers = new Map(),
    listeners = [];
  const distance = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  function listen(type, handler, options) {
    host.addEventListener(type, handler, options);
    listeners.push(() => host.removeEventListener(type, handler, options));
  }
  listen("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    host.focus({ preventScroll: true });
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    host.setPointerCapture(event.pointerId);
    host.classList.add("is-dragging");
  });
  listen("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    event.stopPropagation();
    const before = distance();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1)
      view.rotate(event.clientX - previous.x, event.clientY - previous.y);
    else {
      const after = distance();
      if (before > 0 && after > 0) view.zoom(-Math.log(after / before) * 1000);
    }
  });
  function up(event) {
    pointers.delete(event.pointerId);
    if (host.hasPointerCapture(event.pointerId))
      host.releasePointerCapture(event.pointerId);
    if (!pointers.size) host.classList.remove("is-dragging");
  }
  listen("pointerup", up);
  listen("pointercancel", up);
  listen("lostpointercapture", up);
  listen(
    "wheel",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.zoom(event.deltaY);
    },
    { passive: false },
  );
  listen("keydown", (event) => {
    const arrows = {
      ArrowLeft: [-12, 0],
      ArrowRight: [12, 0],
      ArrowUp: [0, -12],
      ArrowDown: [0, 12],
    };
    if (arrows[event.key]) view.rotate(...arrows[event.key]);
    else if (["+", "="].includes(event.key)) view.zoom(-180);
    else if (["-", "_"].includes(event.key)) view.zoom(180);
    else if (event.key === "Home") fit();
    else return;
    event.preventDefault();
    event.stopPropagation();
  });
  return () => {
    for (const id of pointers.keys())
      if (host.hasPointerCapture(id)) host.releasePointerCapture(id);
    pointers.clear();
    listeners.forEach((remove) => remove());
  };
}
