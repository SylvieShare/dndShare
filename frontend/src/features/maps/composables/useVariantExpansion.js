import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
let currentClose;
const easing = "cubic-bezier(.2,.7,.2,1)";
export function useVariantExpansion(anchor, panel, count) {
  const active = ref(false),
    expanded = ref(false),
    fixed = ref({}),
    height = ref(0);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let epoch = 0,
    timer,
    dragging = false,
    restoringFocus = false,
    dismissed = false,
    pointer = { x: -1, y: -1 },
    animations = [];
  const element = () => panel.value?.$el;
  const rects = () =>
    new Map(
      [...(element()?.querySelectorAll("[data-variant-id]") || [])].map(
        (node) => [
          node.dataset.variantId,
          { node, rect: node.getBoundingClientRect() },
        ],
      ),
    );
  function cancelAnimations() {
    animations.forEach((animation) => animation.cancel());
    animations = [];
  }
  async function setOpen(open, immediate = false) {
    clearTimeout(timer);
    if (!element() || (expanded.value === open && active.value === open))
      return;
    const ticket = ++epoch,
      from = element().getBoundingClientRect(),
      before = rects(),
      shadow = getComputedStyle(element()).boxShadow,
      focused = document.activeElement;
    cancelAnimations();
    if (open && currentClose !== close) {
      currentClose?.();
      currentClose = close;
    }
    const origin = anchor.value.getBoundingClientRect();
    if (!active.value) height.value = from.height;
    active.value = true;
    expanded.value = open;
    const width = open
      ? Math.min(innerWidth - 16, Math.max(origin.width, count() * 128 + 8))
      : origin.width;
    fixed.value = {
      position: "fixed",
      left: `${Math.max(8, Math.min(origin.left, innerWidth - width - 8))}px`,
      top: `${origin.top - (open ? 4 : 0)}px`,
      width: `${width}px`,
      zIndex: 3450,
    };
    await nextTick();
    if (ticket !== epoch || !element()) return;
    if (document.activeElement === document.body && element().contains(focused))
      focused.focus({ preventScroll: true });
    let target = element().getBoundingClientRect();
    if (open) {
      fixed.value = {
        ...fixed.value,
        top: `${Math.max(8, Math.min(origin.top - 4, innerHeight - target.height - 8))}px`,
      };
      await nextTick();
      if (ticket !== epoch || !element()) return;
      target = element().getBoundingClientRect();
    }
    const duration = immediate || reduced.matches ? 0 : 280;
    if (duration) {
      const dx = from.left - target.left,
        dy = from.top - target.top;
      animations.push(
        element().animate(
          [
            {
              width: `${from.width}px`,
              height: `${from.height}px`,
              transform: `translate(${dx}px,${dy}px)`,
              boxShadow: shadow,
            },
            {
              width: `${target.width}px`,
              height: `${target.height}px`,
              transform: "none",
              boxShadow: getComputedStyle(element()).boxShadow,
            },
          ],
          { duration, easing },
        ),
      );
      for (const [id, { node, rect }] of rects()) {
        const previous = before.get(id)?.rect;
        if (!previous || !rect.width || !rect.height) continue;
        animations.push(
          node.animate(
            [
              {
                transform: `translate(${previous.left - rect.left - dx}px,${previous.top - rect.top - dy}px) scale(${previous.width / rect.width},${previous.height / rect.height})`,
              },
              { transform: "none" },
            ],
            { duration, easing },
          ),
        );
      }
      await Promise.allSettled(
        animations.map((animation) => animation.finished),
      );
    }
    if (ticket !== epoch) return;
    cancelAnimations();
    if (!open) {
      active.value = false;
      fixed.value = {};
      height.value = 0;
      if (currentClose === close) currentClose = null;
      const bounds = anchor.value.getBoundingClientRect();
      if (
        pointer.x < bounds.left ||
        pointer.x > bounds.right ||
        pointer.y < bounds.top ||
        pointer.y > bounds.bottom
      )
        dismissed = false;
    }
  }
  const open = () => {
    dismissed = false;
    return setOpen(true);
  };
  const close = () => setOpen(false);
  const dismiss = () => {
    dismissed = true;
    return setOpen(false);
  };
  function scheduleClose(event) {
    clearTimeout(timer);
    if (
      event?.relatedTarget &&
      (element()?.contains(event.relatedTarget) ||
        anchor.value?.contains(event.relatedTarget))
    )
      return;
    if (!dragging) timer = setTimeout(close, 180);
  }
  function enter(event) {
    if (restoringFocus || (dismissed && event?.type !== "focusin")) return;
    clearTimeout(timer);
    open();
  }
  function drag() {
    dragging = true;
    clearTimeout(timer);
  }
  function finishDrag() {
    if (!dragging) return;
    dragging = false;
    scheduleClose();
  }
  function outside(event) {
    if (
      active.value &&
      !element()?.contains(event.target) &&
      !anchor.value?.contains(event.target)
    )
      close();
  }
  function escape(event) {
    if (!active.value || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    dismiss().then(() => {
      restoringFocus = true;
      element()
        ?.querySelector('[role="button"]')
        ?.focus({ preventScroll: true });
      restoringFocus = false;
    });
  }
  const resize = () => setOpen(false, true);
  const scroll = (event) => {
    if (active.value && !element()?.contains(event.target)) close();
  };
  function pointerMove(event) {
    pointer = { x: event.clientX, y: event.clientY };
    if (
      dismissed &&
      !element()?.contains(event.target) &&
      !anchor.value?.contains(event.target)
    )
      dismissed = false;
  }
  onMounted(() => {
    document.addEventListener("pointermove", pointerMove, true);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
  });
  onBeforeUnmount(() => {
    epoch++;
    clearTimeout(timer);
    cancelAnimations();
    if (currentClose === close) currentClose = null;
    document.removeEventListener("pointermove", pointerMove, true);
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", escape, true);
    document.removeEventListener("scroll", scroll, true);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointerup", finishDrag);
    window.removeEventListener("pointercancel", finishDrag);
  });
  return {
    active,
    expanded,
    fixed,
    placeholder: computed(() =>
      active.value ? { height: `${height.value}px` } : {},
    ),
    enter,
    open,
    close,
    dismiss,
    scheduleClose,
    drag,
  };
}
