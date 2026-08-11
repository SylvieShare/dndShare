<script setup>
// "Window" wrapper that morphs out of a tapped tile (container-morph from origin-el/rect) into a
// centered panel, and collapses back. Ported from havenShare's MorphSheet, adapted to dndShare tokens.
//
// Slots: `detail` (main pane) + `sub` (subpage) when a `nav` (useSheetSubpages) is passed; otherwise
// the default slot is the single static pane. The consumer lays out its own header inside the content.
//
// Subpages are a "track of two cells": detail on the left, sub on the right; their transforms come
// from `nav`. Swipe-back drives `nav.pos` live, so the detail pane is visible to the left and slides
// in with the finger. Body height is synced to the active cell.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useContainerMorph } from '@/shared/composables/useContainerMorph'
import { useIsMobile } from '@/shared/composables/useIsMobile'

const props = defineProps({
  originRect: { type: Object, default: null },
  originEl: { type: Object, default: null },
  originRadius: { type: String, default: 'var(--r-lg)' },
  width: { type: Number, default: 440 },         // desktop panel width (px)
  showBack: { type: Boolean, default: false },   // subpage open → swipe-right "back" gesture enabled
  nav: { type: Object, default: null },          // subpage controller (useSheetSubpages)
  frameColor: { type: String, default: '' },     // when set, the panel itself takes a gradient + colored border
})
const emit = defineEmits(['close'])

const isMobile = useIsMobile()

// `nav` arrives as a plain prop object → its refs are NOT auto-unwrapped. Reach `.value` via computeds.
const navView = computed(() => (props.nav ? props.nav.view.value : 'detail'))
const detailStyle = computed(() => (props.nav ? props.nav.detailStyle.value : null))
const subStyle = computed(() => (props.nav ? props.nav.subStyle.value : null))
const subMounted = computed(() => !!props.nav && navView.value !== 'detail')

const panelEl = ref(null)
const bodyEl = ref(null)
const detailCellEl = ref(null)
const subCellEl = ref(null)
const shown = ref(false)
const closing = ref(false)
const revealed = ref(false)   // exposed to slots: false during the open/close morph → fade slot content
const { EASE, visible, morphing, playClose, playOpen } = useContainerMorph()
const endRadius = () => (isMobile.value ? '0px' : '18px')
const HEIGHT_DUR = 320

// Width lives in a CSS var (not a reactive `width` style) so reactive re-renders never re-assert it
// and fight the imperative left/top/width/height morph applied by useContainerMorph.
const sheetStyle = computed(() => ({
  '--ms-w': `${props.width}px`,
  '--ms-body-w': `${props.width}px`,
  '--ms-frame': props.frameColor || undefined,
}))

function cardRect() {
  const el = props.originEl
  if (!el) return props.originRect
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}
function close() {
  if (props.nav && navView.value !== 'detail') { props.nav.backToDetail(); return }
  revealed.value = false
  setBgBlur(false)
  playClose(panelEl.value, cardRect(), { fromRadius: endRadius(), toRadius: props.originRadius }, () => emit('close'))
}
function onKey(e) { if (e.key === 'Escape') close() }

// ===== body height to active cell (desktop) =====
function contentHeight(el) {
  const c = el?.firstElementChild
  return c ? c.scrollHeight : (el?.scrollHeight || 0)
}
function availBody() {
  return Math.floor(window.innerHeight * 0.9)
}
function syncHeight(animate) {
  if (isMobile.value || !bodyEl.value || morphing.value) return
  const p = props.nav ? props.nav.pos.value : 0
  const dH = contentHeight(detailCellEl.value)
  const sH = subCellEl.value ? contentHeight(subCellEl.value) : dH
  const target = dH * (1 - p) + sH * p
  const h = Math.min(target, Math.max(120, availBody()))
  bodyEl.value.style.transition = animate ? `height ${HEIGHT_DUR}ms ${EASE}` : 'none'
  bodyEl.value.style.height = `${h}px`
}

let ro = null
function observeContent() {
  if (!ro) return
  ro.disconnect()
  ;[detailCellEl.value?.firstElementChild, subCellEl.value?.firstElementChild].forEach((el) => { if (el) ro.observe(el) })
}
function onContentResize() {
  if (morphing.value || (props.nav && props.nav.animating.value) || dragging) return
  syncHeight(false)
}

if (props.nav) {
  watch(() => props.nav.pos.value, () => syncHeight(props.nav.animating.value))
  watch(() => props.nav.view.value, (v, prev) => nextTick(() => {
    observeContent()
    if (v !== 'detail' && prev === 'detail' && subCellEl.value) {
      void subCellEl.value.offsetWidth
      props.nav.enterSub()
    }
    if (!props.nav.animating.value) syncHeight(false)
  }))
}

// ===== mobile: swipe down (close) + swipe right (back) =====
const dragY = ref(0)
let dragging = false
let startX = 0, startY = 0, decided = null, backDx = 0, startTarget = null
let lastX = 0, lastT = 0, vx = 0
const CLOSE_DOWN_DUR = 260
function onTouchStart(e) {
  if (!isMobile.value || morphing.value) return
  startX = e.touches[0].clientX
  startY = e.touches[0].clientY
  startTarget = e.target
  decided = null
}
function atScrollTop() {
  let el = startTarget
  while (el && el !== panelEl.value) {
    if (el.scrollHeight > el.clientHeight + 1) {
      const oy = getComputedStyle(el).overflowY
      if ((oy === 'auto' || oy === 'scroll') && el.scrollTop > 0) return false
    }
    el = el.parentElement
  }
  return true
}
function onTouchMove(e) {
  if (!isMobile.value || morphing.value || decided === 'scroll') return
  const dx = e.touches[0].clientX - startX
  const dy = e.touches[0].clientY - startY
  if (decided === null) {
    if (props.showBack && props.nav && dx > 8 && Math.abs(dx) > Math.abs(dy)) {
      decided = 'back'; dragging = true; backDx = dx
      lastX = e.touches[0].clientX; lastT = e.timeStamp; vx = 0
      props.nav.dragStart(bodyEl.value?.clientWidth || window.innerWidth)
      return
    }
    if (dy > 6 && atScrollTop() && Math.abs(dy) >= Math.abs(dx)) decided = 'drag'
    else if (Math.abs(dy) > 6 || Math.abs(dx) > 6) { decided = 'scroll'; return }
    else return
  }
  if (decided === 'back') {
    backDx = Math.max(0, dx)
    if (e.cancelable) e.preventDefault()
    const x = e.touches[0].clientX, t = e.timeStamp
    if (t > lastT) vx = (x - lastX) / (t - lastT)
    lastX = x; lastT = t
    props.nav.dragMove(backDx)
    return
  }
  if (decided !== 'drag') return
  if (e.cancelable) e.preventDefault()
  dragY.value = Math.max(0, dy)
  const el = panelEl.value
  if (el) { el.style.transition = 'none'; el.style.transform = `translateY(${dragY.value}px)` }
}
function onTouchEnd() {
  if (decided === 'back') {
    dragging = false; decided = null
    props.nav.dragEnd(backDx, vx)
    backDx = 0; vx = 0
    return
  }
  if (decided !== 'drag') { decided = null; return }
  decided = null
  const el = panelEl.value
  if (dragY.value > 120) { closeDown(); return }
  dragY.value = 0
  if (el) { el.style.transition = `transform .26s ${EASE}`; el.style.transform = 'translateY(0)' }
}
function closeDown() {
  const el = panelEl.value
  if (el) { el.style.transition = `transform ${CLOSE_DOWN_DUR}ms ${EASE}`; el.style.transform = `translateY(${window.innerHeight}px)` }
  visible.value = false
  revealed.value = false
  revealOriginSmoothly()
  setBgBlur(false)
  setTimeout(() => emit('close'), CLOSE_DOWN_DUR)
}

// Blur the page content behind the desktop window. We blur `#app` (the overlay is teleported to
// <body>, a sibling of #app, so it stays sharp) with a real `filter: blur()` — `backdrop-filter` is
// unreliable (unsupported / hardware-accel-gated in some Chromium builds e.g. Yandex, and the
// unprefixed prop gets dropped by our CSS minifier), whereas `filter` is universally supported.
// Mobile sheets cover the whole viewport, so blurring the hidden page only adds GPU work during the
// morph without changing the final appearance.
const BG_BLUR = '8px'
function setBgBlur(on) {
  const el = document.getElementById('app')
  if (!el) return
  if (isMobile.value) {
    el.style.transition = ''
    el.style.filter = ''
    return
  }
  el.style.transition = 'filter .3s ease'
  el.style.filter = on ? `blur(${BG_BLUR})` : ''
}

// Hide the source tile (instantly, without unmounting it) while the window is open — the morph panel
// IS its visual stand-in, so leaving the tile visible behind would read as a duplicate. `opacity` keeps
// its layout box and `getBoundingClientRect` intact, so the close morph can still target it.
let originOpacity = ''
let originTransition = ''
let originRevealing = false

function rememberOriginStyle() {
  const el = props.originEl
  if (!el) return
  originOpacity = el.style.opacity
  originTransition = el.style.transition
}

function setOriginHidden(hidden) {
  const el = props.originEl
  if (!el) return
  el.style.opacity = hidden ? '0' : originOpacity
}

// A swipe-down close has no reverse container morph to cover the source tile. Fade that tile back
// while the sheet leaves the viewport, then restore its original inline transition untouched.
function revealOriginSmoothly() {
  const el = props.originEl
  if (!el) return
  originRevealing = true
  const prefix = originTransition && originTransition !== 'none' ? `${originTransition}, ` : ''
  el.style.transition = `${prefix}opacity ${CLOSE_DOWN_DUR}ms ease`
  el.style.opacity = '0'
  requestAnimationFrame(() => { el.style.opacity = originOpacity })
  setTimeout(() => {
    el.style.opacity = originOpacity
    el.style.transition = originTransition
    originRevealing = false
  }, CLOSE_DOWN_DUR + 20)
}

let prevHtmlOverflow = ''
function onWinResize() {
  if (morphing.value) return
  if (isMobile.value && bodyEl.value) bodyEl.value.style.height = ''
  else syncHeight(false)
}
onMounted(async () => {
  prevHtmlOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
  if (typeof ResizeObserver !== 'undefined') ro = new ResizeObserver(onContentResize)
  await nextTick()
  syncHeight(false)
  observeContent()
  shown.value = true
  rememberOriginStyle()
  setOriginHidden(true)
  playOpen(panelEl.value, props.originRect, { fromRadius: props.originRadius, toRadius: endRadius() })
  setBgBlur(true)
  // Start revealing secondary content with the container FLIP; consumers set the opacity duration
  // to match the open morph so the reveal finishes exactly when the morph settles.
  setTimeout(() => {
    revealed.value = true
    syncHeight(false)
  }, 20)
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', onWinResize)
})
onBeforeUnmount(() => {
  document.documentElement.style.overflow = prevHtmlOverflow
  setBgBlur(false)
  if (!originRevealing) setOriginHidden(false)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onWinResize)
  ro?.disconnect()
})

defineExpose({ close })
</script>

<template>
  <!-- Teleport to body: a transformed/`will-change` ancestor (e.g. the mobile swipe track) would
       both reparent our `position: fixed` and kill `backdrop-filter`. Morph coords are viewport-based,
       so teleporting only makes them more correct. -->
  <teleport to="body">
    <div class="ms-overlay" :class="{ visible }" @click.self="close">
    <div
      ref="panelEl" class="ms-sheet" :class="{ shown, closing, 'ms-framed': frameColor }" :style="sheetStyle"
      @touchstart.passive="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd"
    >
      <div class="ms-grab"></div>

      <div ref="bodyEl" class="ms-body">
        <div ref="detailCellEl" class="ms-cell" :style="detailStyle">
          <slot name="detail" :revealed="revealed"><slot :revealed="revealed" /></slot>
        </div>
        <div v-if="subMounted" ref="subCellEl" class="ms-cell" :style="subStyle">
          <slot name="sub" />
        </div>
      </div>
    </div>
    </div>
  </teleport>
</template>

<style scoped>
/* flex centering (not grid): a grid `auto` track + `max-width:100%` collapses the panel to its
   content min-width once the morph clears `position:fixed`. Flex resolves `max-width:100%` against
   the full overlay, so the panel keeps its `--ms-w` width. */
/* Dim only — on desktop the blur is done by `filter: blur()` on #app (see setBgBlur), because
   `backdrop-filter` is unsupported/disabled in some Chromium builds (e.g. Yandex Browser). Mobile
   sheets cover the viewport and intentionally skip the background blur. */
.ms-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; background: color-mix(in srgb, var(--scrim) 1%, transparent); transition: background .3s ease; }
.ms-overlay.visible { background: color-mix(in srgb, var(--scrim) 73%, transparent); }
.ms-sheet { flex: none; position: relative; box-sizing: border-box; width: var(--ms-w, 440px); max-width: 100%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; background: var(--surface); border: 1px solid var(--border); border-radius: 18px; box-shadow: var(--shadow-lg); opacity: 0; }
/* framed panel: the morphing block's gradient + colored border spans the whole window */
.ms-sheet.ms-framed { background: linear-gradient(135deg, var(--surface) 55%, color-mix(in srgb, var(--ms-frame) 8%, var(--surface))); border-color: transparent; }
.ms-sheet.ms-framed::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--ms-frame) 32%, var(--border));
  border-radius: inherit;
  pointer-events: none;
  z-index: 5;
}
.ms-sheet.shown { opacity: 1; }
.ms-sheet.shown.closing { opacity: 0; transition: opacity .2s ease; }

.ms-grab { display: none; }

/* Pin the body to the FINAL width (`--ms-w`): the content is laid out at full width from frame 1, so
   the panel's animating width just reveals it (overflow:hidden clips) instead of reflowing the text. */
.ms-body { flex: 0 0 auto; min-height: 0; position: relative; overflow: hidden; width: var(--ms-body-w, var(--ms-w, 440px)); }
.ms-cell { position: absolute; inset: 0; overflow-y: auto; overflow-x: clip; will-change: transform; }

@media (max-width: 768px) {
  .ms-overlay { padding: 0; align-items: stretch; justify-content: stretch; }
  .ms-sheet { width: 100%; max-width: none; height: 100dvh; max-height: none; border: 0; border-radius: 0; }
  .ms-body { flex: 1; height: auto; width: auto; }
  .ms-grab { display: block; position: absolute; top: calc(7px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); width: 40px; height: 4px; border-radius: 2px; background: var(--border-strong); z-index: 6; pointer-events: none; }
}
</style>
