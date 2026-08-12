<template>
  <teleport to="body">
    <div
      ref="overlay"
      class="am-overlay"
      :style="[
        zIndex !== 3000 ? { zIndex } : {},
        { '--am-fullscreen-height': fullscreenHeight },
      ]"
      role="dialog"
      aria-modal="true"
      @mousedown.self="requestClose"
    >
      <div
        ref="card"
        class="am-card"
        :class="{
          'am-card-wide': wide,
          'am-card-extra-wide': extraWide,
          'am-card-full': fullscreen,
          'am-card-flush': flush,
        }"
        tabindex="-1"
        @touchstart.passive="onTouchStart"
        @touchmove="onTouchMove"
        @touchend.passive="onTouchEnd"
        @touchcancel.passive="cancelDrag"
      >
        <div v-if="showHandle" class="am-handle"></div>
        <button v-if="showClose && !fullscreen" class="am-close" type="button" aria-label="Закрыть" @click="requestClose">✕</button>
        <slot />
      </div>
    </div>
  </teleport>
</template>

<script>
const MOBILE = () => window.innerWidth <= 640
const DUR_IN  = 260
const DUR_OUT = 280
const EASE_SLIDE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const modalStack = []
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function restoreFocus(element) {
  element.focus({ preventScroll: true })
}
</script>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useFullscreenViewportHeight } from '@/shared/composables/useFullscreenViewportHeight'

const props = defineProps({
  zIndex: { type: Number, default: 3000 },
  wide: { type: Boolean, default: false },
  extraWide: { type: Boolean, default: false },
  fullscreen: { type: Boolean, default: false },
  showClose: { type: Boolean, default: true },
  showHandle: { type: Boolean, default: true },
  dismissible: { type: Boolean, default: true },
  // Lets a higher-level shell own padding, scrolling and fixed chrome.
  flush: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'opened'])

const overlay = ref(null)
const card    = ref(null)
const fullscreenHeight = useFullscreenViewportHeight()

const isDragging          = ref(false)
const dragY               = ref(0)
const touchStartY         = ref(0)
const touchStartScrollTop = ref(0)

let _unmounted  = false
let _closeTimer = null
let _closing = false
const stackToken = Symbol('app-modal')
const previouslyFocused = typeof document !== 'undefined' ? document.activeElement : null

function _onKeydown(e) {
  if (modalStack.at(-1) !== stackToken) return
  if (e.key === 'Escape') {
    requestClose()
    return
  }
  if (e.key !== 'Tab') return
  const focusable = [...(card.value?.querySelectorAll(FOCUSABLE) || [])]
    .filter(element => element.getClientRects().length > 0)
  if (!focusable.length) {
    e.preventDefault()
    card.value?.focus()
    return
  }
  const first = focusable[0]
  const last = focusable.at(-1)
  if (e.shiftKey && (document.activeElement === first || !card.value?.contains(document.activeElement))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (document.activeElement === last || !card.value?.contains(document.activeElement))) {
    e.preventDefault()
    first.focus()
  }
}

function _animateIn() {
  const ov = overlay.value; const c = card.value
  if (!ov || !c) return
  ov.style.opacity = '0'
  ov.style.backdropFilter = 'blur(0px)'
  ov.style.webkitBackdropFilter = 'blur(0px)'
  if (MOBILE()) {
    c.style.transform = 'translateY(100%)'
  } else {
    c.style.transform = 'scale(0.95) translateY(10px)'
    c.style.opacity = '0'
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const EASE_OPACITY_IN = 'cubic-bezier(0, 0, 0.4, 1)'
      const ovTr = `opacity ${DUR_IN}ms ${EASE_OPACITY_IN}, backdrop-filter ${DUR_IN}ms ${EASE_OPACITY_IN}, -webkit-backdrop-filter ${DUR_IN}ms ${EASE_OPACITY_IN}`
      ov.style.transition = ovTr
      ov.style.opacity = '1'
      ov.style.backdropFilter = 'blur(6px)'
      ov.style.webkitBackdropFilter = 'blur(6px)'
      if (MOBILE()) {
        c.style.transition = `transform ${DUR_IN}ms ${EASE_SLIDE}`
        c.style.transform = 'translateY(0)'
      } else {
        c.style.transition = `transform ${DUR_IN}ms ${EASE_SLIDE}, opacity ${DUR_IN}ms ${EASE_OPACITY_IN}`
        c.style.transform = 'none'
        c.style.opacity = '1'
      }
      setTimeout(() => {
        if (_unmounted) return
        ov.style.transition = ''
        // Keep the blur applied inline. Clearing it would fall back to the `.am-overlay` CSS rule,
        // whose unprefixed `backdrop-filter` the minifier drops (and which is unreliable in some
        // Chromium builds), so the blur would snap off at the end of the open animation.
        ov.style.backdropFilter = 'blur(6px)'
        ov.style.webkitBackdropFilter = 'blur(6px)'
        c.style.transition = ''
        c.style.transform = ''
        c.style.opacity = ''
        emit('opened')
      }, DUR_IN + 50)
    })
  })
}

function _animateOut() {
  const ov = overlay.value; const c = card.value
  if (!ov || !c) {
    _closeTimer = setTimeout(() => { if (!_unmounted) emit('close') }, 0)
    return
  }
  const ovTr = `opacity ${DUR_OUT}ms ease, backdrop-filter ${DUR_OUT}ms ease, -webkit-backdrop-filter ${DUR_OUT}ms ease`
  ov.style.transition = ovTr
  ov.style.opacity = '0'
  ov.style.backdropFilter = 'blur(0px)'
  ov.style.webkitBackdropFilter = 'blur(0px)'
  if (MOBILE()) {
    c.style.transition = `transform ${DUR_OUT}ms ${EASE_SLIDE}`
    c.style.transform = 'translateY(100%)'
  } else {
    c.style.transition = `transform ${DUR_OUT}ms ease, opacity ${DUR_OUT}ms ease`
    c.style.transform = 'scale(0.95) translateY(10px)'
    c.style.opacity = '0'
  }
  _closeTimer = setTimeout(() => {
    if (!_unmounted) emit('close')
  }, DUR_OUT + 20)
}

function requestClose() {
  if (!props.dismissible || _closing) return
  _closing = true
  _animateOut()
}

defineExpose({ requestClose })

function onTouchStart(e) {
  if (!props.dismissible) return
  touchStartY.value = e.touches[0].clientY
  let scrollElement = e.target instanceof Element ? e.target : null
  while (scrollElement && scrollElement !== card.value) {
    const style = window.getComputedStyle(scrollElement)
    const scrollable = /(auto|scroll)/.test(style.overflowY)
      && scrollElement.scrollHeight > scrollElement.clientHeight
    if (scrollable) break
    scrollElement = scrollElement.parentElement
  }
  touchStartScrollTop.value = scrollElement?.scrollTop || card.value?.scrollTop || 0
  isDragging.value = false
  dragY.value = 0
}

function onTouchMove(e) {
  if (!props.dismissible) return
  const dy = e.touches[0].clientY - touchStartY.value
  if (!isDragging.value) {
    if (dy > 8 && touchStartScrollTop.value <= 0) {
      isDragging.value = true
    } else {
      return
    }
  }
  e.preventDefault()
  dragY.value = Math.max(0, dy)
  const c = card.value; const ov = overlay.value
  if (c)  { c.style.transition = 'none'; c.style.transform = `translateY(${dragY.value}px)` }
  if (ov) { ov.style.transition = 'none'; ov.style.opacity = String(Math.max(0, 1 - dragY.value / 320)) }
}

function onTouchEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  const c = card.value; const ov = overlay.value
  if (dragY.value > 100) {
    if (c)  { c.style.transition = `transform ${DUR_OUT}ms ${EASE_SLIDE}`; c.style.transform = 'translateY(100%)' }
    if (ov) { ov.style.transition = `opacity ${DUR_OUT}ms ease`; ov.style.opacity = '0' }
    _closeTimer = setTimeout(() => {
      if (!_unmounted) emit('close')
    }, DUR_OUT + 20)
  } else {
    if (c)  { c.style.transition = `transform ${DUR_OUT}ms ${EASE_SLIDE}`; c.style.transform = 'translateY(0)' }
    if (ov) { ov.style.transition = 'opacity 200ms ease'; ov.style.opacity = '1' }
    dragY.value = 0
    setTimeout(() => {
      if (_unmounted) return
      if (c)  { c.style.transition = ''; c.style.transform = '' }
      if (ov) { ov.style.transition = ''; ov.style.opacity = '' }
    }, DUR_OUT + 50)
  }
}

function cancelDrag() {
  if (!isDragging.value) return
  isDragging.value = false
  dragY.value = 0
  const c = card.value; const ov = overlay.value
  if (c)  { c.style.transition = `transform ${DUR_OUT}ms ${EASE_SLIDE}`; c.style.transform = 'translateY(0)' }
  if (ov) { ov.style.transition = 'opacity 200ms ease'; ov.style.opacity = '1' }
  setTimeout(() => {
    if (_unmounted) return
    if (c)  { c.style.transition = ''; c.style.transform = '' }
    if (ov) { ov.style.transition = ''; ov.style.opacity = '' }
  }, DUR_OUT + 50)
}

onMounted(() => {
  modalStack.push(stackToken)
  document.addEventListener('keydown', _onKeydown)
  nextTick(() => {
    _animateIn()
    if (!card.value?.contains(document.activeElement)) {
      card.value?.querySelector(FOCUSABLE)?.focus()
      if (!card.value?.contains(document.activeElement)) card.value?.focus()
    }
  })
})

onBeforeUnmount(() => {
  const stackIndex = modalStack.indexOf(stackToken)
  if (stackIndex >= 0) modalStack.splice(stackIndex, 1)
  document.removeEventListener('keydown', _onKeydown)
  clearTimeout(_closeTimer)
  _unmounted = true
  if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) restoreFocus(previouslyFocused)
})
</script>

<style scoped>
.am-overlay {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.am-card {
  position: relative;
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: 18px;
  padding: 28px 28px 24px;
  width: 480px;
  max-width: 94vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.am-card-flush {
  padding: 0;
  gap: 0;
  overflow: hidden;
}

.am-card-wide {
  width: 720px;
}

.am-card-extra-wide {
  width: 1100px;
}

.am-card-full {
  width: min(1400px, 96vw);
  max-width: none;
  height: 92vh;
  max-height: 92vh;
  padding: 0;
  gap: 0;
  border-radius: 16px;
  overflow: hidden;
}

.am-handle {
  display: none;
}

@media (max-width: 640px) {
  .am-handle {
    display: block;
    width: 36px;
    height: 4px;
    background: var(--text-muted);
    border-radius: 2px;
    margin: -32px auto 20px;
  }
}

.am-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--r-sm);
  transition: color 0.15s;
  touch-action: manipulation;
  line-height: 1;
}
.am-close:hover { color: var(--text-2); }

@media (max-width: 640px) {
  .am-overlay {
    align-items: flex-end;
  }

  .am-card {
    width: 100%;
    max-width: 100%;
    max-height: 80vh;
    border-radius: 18px 18px 0 0;
    padding: 52px 20px 32px;
  }

  .am-card-flush {
    padding: 0;
  }

  .am-close {
    top: 14px;
    right: 14px;
    font-size: 18px;
    padding: 8px;
    color: var(--text-muted);
  }

  .am-card-full {
    width: 100%;
    max-width: 100%;
    height: 94vh;
    max-height: 94vh;
    height: 94dvh;
    max-height: 94dvh;
    height: var(--am-fullscreen-height, 94dvh);
    max-height: var(--am-fullscreen-height, 94dvh);
    padding: 0;
    border-radius: 16px 16px 0 0;
  }
}
</style>
