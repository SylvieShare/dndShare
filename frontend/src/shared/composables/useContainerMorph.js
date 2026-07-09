import { ref } from 'vue'

// Container morph: an element grows from a source rect (a tapped tile) into its natural
// size/position and collapses back — animating left/top/width/height + border-radius + box-shadow
// (no scale, so content isn't distorted). Ported from havenShare.
//
// `visible` flips true on open / false on close — bind it to drive the backdrop (dim + blur).
// The panel itself stays OPAQUE through the whole morph (see the sheet's `shown` flag) so it
// reads as "the tile turns into the window", not "a window fades in".
export function useContainerMorph({ open = 420, close = 300 } = {}) {
  const EASE = 'cubic-bezier(.2, 0, 0, 1)'
  const SHADOW = 'var(--shadow-lg)'
  const RECT_PROPS = ['position', 'margin', 'left', 'top', 'width', 'height', 'maxHeight', 'overflow', 'borderRadius', 'boxShadow', 'transition']

  const visible = ref(false)
  const morphing = ref(false)
  let timer = null

  function applyRect(el, r, animate, ms) {
    el.style.position = 'fixed'
    el.style.margin = '0'
    el.style.left = `${r.left}px`
    el.style.top = `${r.top}px`
    el.style.width = `${r.width}px`
    el.style.height = `${r.height}px`
    el.style.maxHeight = 'none'
    el.style.overflow = 'hidden'
    el.style.transition = animate
      ? `left ${ms}ms ${EASE}, top ${ms}ms ${EASE}, width ${ms}ms ${EASE}, height ${ms}ms ${EASE}, border-radius ${ms}ms ${EASE}, box-shadow ${ms}ms ${EASE}`
      : 'none'
  }
  function clearRect(el) { RECT_PROPS.forEach((p) => el.style.removeProperty(p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()))) }

  function playOpen(el, fromRect, { fromRadius = '0px', toRadius = '0px' } = {}) {
    clearTimeout(timer)
    if (!el || !fromRect) { visible.value = true; return }
    morphing.value = true
    const f = el.getBoundingClientRect()
    applyRect(el, fromRect, false, open)
    el.style.borderRadius = fromRadius
    el.style.boxShadow = 'none'
    void el.offsetWidth
    visible.value = true
    applyRect(el, f, true, open)
    el.style.borderRadius = toRadius
    el.style.boxShadow = SHADOW
    timer = setTimeout(() => { clearRect(el); morphing.value = false }, open + 20)
  }

  function playClose(el, toRect, { fromRadius = '0px', toRadius = '0px' } = {}, done = () => {}) {
    clearTimeout(timer)
    if (!el || !toRect) { visible.value = false; timer = setTimeout(done, 240); return }
    morphing.value = true
    const f = el.getBoundingClientRect()
    applyRect(el, f, false, close)
    el.style.borderRadius = fromRadius
    el.style.boxShadow = SHADOW
    void el.offsetWidth
    visible.value = false
    applyRect(el, toRect, true, close)
    el.style.borderRadius = toRadius
    el.style.boxShadow = 'none'
    timer = setTimeout(done, close)
  }

  return { EASE, visible, morphing, playOpen, playClose }
}
