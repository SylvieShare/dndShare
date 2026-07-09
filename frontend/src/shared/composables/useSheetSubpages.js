import { computed, ref } from 'vue'

// Subpage mechanics for MorphSheet as a "track of two cells": detail on the left, the active
// subpage on the right. `pos` (0 = detail visible, 1 = subpage visible) is the single source of
// truth — both cell transforms derive from it. Button navigation (goSub/backToDetail) animates
// `pos`; the swipe-back gesture drives it live under the finger. Ported from havenShare.
const EASE = 'cubic-bezier(.2, 0, 0, 1)'
const DUR = 320

export function useSheetSubpages() {
  const view = ref('detail')   // 'detail' | <subpage id>
  const pos = ref(0)           // 0 = detail, 1 = subpage
  const animating = ref(false)
  let width = 1
  let timer = null

  const transition = computed(() => (animating.value ? `transform ${DUR}ms ${EASE}` : 'none'))
  const detailStyle = computed(() => ({ transform: `translateX(${(-pos.value * 100).toFixed(3)}%)`, transition: transition.value }))
  const subStyle = computed(() => ({ transform: `translateX(${((1 - pos.value) * 100).toFixed(3)}%)`, transition: transition.value }))

  function settle(target, after) {
    clearTimeout(timer)
    animating.value = true
    pos.value = target
    timer = setTimeout(() => { animating.value = false; if (after) after() }, DUR + 10)
  }

  function goSub(v) {
    if (view.value !== 'detail') return
    animating.value = false
    pos.value = 0
    view.value = v
  }
  function enterSub() { settle(1) }
  function backToDetail() {
    if (view.value === 'detail') return
    settle(0, () => { view.value = 'detail' })
  }

  function dragStart(w) { clearTimeout(timer); animating.value = false; width = w || 1 }
  function dragMove(dx) { pos.value = Math.min(1, Math.max(0, 1 - dx / width)) }
  function dragEnd(dx, vx) {
    const committed = dx > width * 0.35 || vx > 0.4
    if (committed) settle(0, () => { view.value = 'detail' })
    else settle(1)
  }

  return { view, pos, animating, detailStyle, subStyle, goSub, enterSub, backToDetail, dragStart, dragMove, dragEnd }
}
