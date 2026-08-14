<template>
  <div v-if="$slots.trigger" ref="triggerEl" class="ram-custom-trigger" :class="{ 'ram-custom-trigger--block': block }" @click.stop="toggle">
    <slot name="trigger" :open="isOpen" />
  </div>
  <button
    v-else
    ref="triggerEl"
    type="button"
    class="ram-trigger"
    :title="title"
    @click.stop="toggle"
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="3" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="11" cy="7" r="1.2" fill="currentColor"/>
    </svg>
  </button>

  <Teleport to="body">
    <Transition name="ram-popover">
      <div
        v-if="isOpen"
        ref="popoverEl"
        class="ram-popover"
        :style="popoverStyle"
        @click.stop
        @pointerdown.stop
      >
        <slot :close="close" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'
import { computeRowActionPlacement, ROW_ACTION_MARGIN } from '@/shared/ui/rowActionPlacement'

const props = defineProps({
  title: { type: String, default: 'Действия' },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
})

const openInstance = (() => {
  if (!window.__ramOpenRef) window.__ramOpenRef = shallowRef(null)
  return window.__ramOpenRef
})()

const myId = Symbol('row-action-menu')
const triggerEl = ref(null)
const popoverEl = ref(null)
const popoverStyle = ref(null)
let openOrigin = null
let placementFrame = null

const isOpen = computed(() => openInstance.value === myId)

function initialStyle(event) {
  const el = triggerEl.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const hasPointerOrigin = event?.detail > 0
  openOrigin = {
    x: hasPointerOrigin ? event.clientX : rect.left + rect.width / 2,
    y: hasPointerOrigin ? event.clientY : rect.bottom,
  }
  return {
    position: 'fixed',
    top: `${ROW_ACTION_MARGIN}px`,
    left: `${ROW_ACTION_MARGIN}px`,
    visibility: 'hidden',
  }
}

function viewportRect() {
  const viewport = window.visualViewport
  return {
    viewportWidth: viewport?.width || window.innerWidth,
    viewportHeight: viewport?.height || window.innerHeight,
    viewportLeft: viewport?.offsetLeft || 0,
    viewportTop: viewport?.offsetTop || 0,
  }
}

function placePopover() {
  placementFrame = null
  const trigger = triggerEl.value
  const popover = popoverEl.value
  if (!isOpen.value || !trigger || !popover) return

  const viewport = viewportRect()
  const availableWidth = Math.max(0, viewport.viewportWidth - ROW_ACTION_MARGIN * 2)
  popover.style.minWidth = `${Math.min(200, availableWidth)}px`
  popover.style.maxWidth = `${Math.min(280, availableWidth)}px`

  const rect = trigger.getBoundingClientRect()
  const popoverRect = popover.getBoundingClientRect()
  const placement = computeRowActionPlacement({
    triggerRect: rect,
    popoverWidth: popoverRect.width,
    popoverHeight: popover.scrollHeight,
    originX: openOrigin?.x ?? rect.left + rect.width / 2,
    originY: openOrigin?.y ?? rect.bottom,
    ...viewport,
  })

  popoverStyle.value = {
    position: 'fixed',
    top: `${placement.top}px`,
    left: `${placement.left}px`,
    minWidth: `${Math.min(200, availableWidth)}px`,
    maxWidth: `${Math.min(280, availableWidth)}px`,
    maxHeight: `${placement.maxHeight}px`,
    visibility: 'visible',
    '--ram-origin-x': `${placement.originX}px`,
    '--ram-origin-y': `${placement.originY}px`,
    '--ram-enter-y': placement.opensAbove ? '5px' : '-5px',
  }
}

function schedulePlacement() {
  if (placementFrame != null) cancelAnimationFrame(placementFrame)
  placementFrame = requestAnimationFrame(placePopover)
}

function open(event) {
  popoverStyle.value = initialStyle(event)
  openInstance.value = myId
  nextTick(schedulePlacement)
  document.addEventListener('pointerdown', onDocPointerDown, true)
  window.addEventListener('resize', schedulePlacement)
  window.addEventListener('scroll', onWindowScroll, true)
  window.visualViewport?.addEventListener('resize', schedulePlacement)
  window.visualViewport?.addEventListener('scroll', schedulePlacement)
}

function close() {
  if (openInstance.value === myId) openInstance.value = null
  if (placementFrame != null) cancelAnimationFrame(placementFrame)
  placementFrame = null
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  window.removeEventListener('resize', schedulePlacement)
  window.removeEventListener('scroll', onWindowScroll, true)
  window.visualViewport?.removeEventListener('resize', schedulePlacement)
  window.visualViewport?.removeEventListener('scroll', schedulePlacement)
}

function toggle(event) {
  if (props.disabled) return
  if (isOpen.value) close()
  else open(event)
}

function onDocPointerDown(e) {
  if (e.target?.closest?.('.ram-popover')) return
  if (e.target === triggerEl.value || triggerEl.value?.contains?.(e.target)) return
  close()
}

function onWindowScroll(event) {
  if (event.target === popoverEl.value || popoverEl.value?.contains?.(event.target)) return
  close()
}

onBeforeUnmount(close)

defineExpose({ close })
</script>

<style scoped>
.ram-custom-trigger {
  display: inline-flex;
  transform-origin: center;
  transition: transform 90ms cubic-bezier(0.2, 0.8, 0.3, 1);
}
.ram-custom-trigger--block { display: block; width: 100%; }
.ram-custom-trigger:active { transform: scale(0.97); }

.ram-trigger {
  width: 26px;
  height: 26px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center;
  transition: color 100ms ease, background-color 100ms ease, transform 90ms cubic-bezier(0.2, 0.8, 0.3, 1);
}
.ram-trigger:hover { color: var(--text-1); background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.ram-trigger:active { transform: scale(0.88); }

@media (prefers-reduced-motion: reduce) {
  .ram-custom-trigger, .ram-trigger { transition: none; }
  .ram-custom-trigger:active, .ram-trigger:active { transform: none; }
}
</style>

<style>
.ram-popover {
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  padding: 5px;
  box-shadow: var(--shadow-lg);
  z-index: 9300;
  min-width: min(200px, calc(100vw - 16px));
  max-width: min(280px, calc(100vw - 16px));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  transform-origin: var(--ram-origin-x, 100%) var(--ram-origin-y, 0);
  will-change: opacity, transform;
}

.ram-popover-enter-active {
  transition:
    opacity 135ms ease-out,
    transform 165ms cubic-bezier(0.16, 1, 0.3, 1);
}
.ram-popover-leave-active {
  pointer-events: none;
  transition:
    opacity 90ms ease-in,
    transform 110ms cubic-bezier(0.4, 0, 1, 1);
}
.ram-popover-enter-from,
.ram-popover-leave-to {
  opacity: 0;
  transform: translateY(var(--ram-enter-y, -5px)) scale(0.96);
}
.ram-popover-enter-to,
.ram-popover-leave-from { opacity: 1; transform: none; }

.ram-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 5px 5px 3px;
}

.ram-colors {
  display: grid;
  grid-template-columns: repeat(6, 22px);
  gap: 4px;
  justify-content: start;
  margin-bottom: 4px;
  padding: 0 3px;
}

.ram-swatch {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 2px solid color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s, border-color 0.15s;
}
.ram-swatch:hover { transform: scale(1.08); }
.ram-swatch.ram-swatch--active { border-color: var(--text-on-accent); box-shadow: 0 0 0 2px var(--accent); }
.ram-swatch--reset {
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (prefers-reduced-motion: reduce) {
  .ram-popover-enter-active, .ram-popover-leave-active { transition: none; }
}
</style>
