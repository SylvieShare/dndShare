<template>
  <div v-if="$slots.trigger" ref="triggerEl" class="ram-custom-trigger" @click.stop="toggle">
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
    <div
      v-if="isOpen"
      class="ram-popover"
      :style="popoverStyle"
      @click.stop
      @pointerdown.stop
    >
      <slot :close="close" />
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'

defineProps({
  title: { type: String, default: 'Действия' },
})

const openInstance = (() => {
  if (!window.__ramOpenRef) window.__ramOpenRef = shallowRef(null)
  return window.__ramOpenRef
})()

const myId = Symbol('row-action-menu')
const triggerEl = ref(null)
const popoverStyle = ref(null)

const isOpen = computed(() => openInstance.value === myId)

function computeStyle(event) {
  const el = triggerEl.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const top = rect.bottom + 6
  const right = Math.max(8, window.innerWidth - rect.right)
  const popoverRight = window.innerWidth - right
  const hasPointerOrigin = event?.detail > 0
  const originX = hasPointerOrigin ? event.clientX : rect.left + rect.width / 2
  const originY = hasPointerOrigin ? event.clientY : rect.bottom
  return {
    position: 'fixed',
    top: top + 'px',
    right: right + 'px',
    '--ram-origin-x': `calc(100% - ${popoverRight - originX}px)`,
    '--ram-origin-y': `${originY - top}px`,
  }
}

function open(event) {
  popoverStyle.value = computeStyle(event)
  openInstance.value = myId
  document.addEventListener('pointerdown', onDocPointerDown, true)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', close, true)
}

function close() {
  if (openInstance.value === myId) openInstance.value = null
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', close, true)
}

function toggle(event) {
  if (isOpen.value) close()
  else open(event)
}

function onDocPointerDown(e) {
  if (e.target?.closest?.('.ram-popover')) return
  if (e.target === triggerEl.value || triggerEl.value?.contains?.(e.target)) return
  close()
}

onBeforeUnmount(close)

defineExpose({ close })
</script>

<style scoped>
.ram-custom-trigger {
  display: inline-flex;
}

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
}
.ram-trigger:hover { color: var(--text-1); background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
</style>

<style>
.ram-popover {
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  padding: 8px;
  box-shadow: var(--shadow-lg);
  z-index: 9300;
  min-width: 200px;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transform-origin: var(--ram-origin-x, 100%) var(--ram-origin-y, 0);
  animation: ram-popover-enter 140ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
}

@keyframes ram-popover-enter {
  from { opacity: 0; transform: translateY(-2px) scale(0.96); }
  to { opacity: 1; transform: none; }
}

.ram-item {
  display: block;
  width: 100%;
  padding: 7px 10px;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-1);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.ram-item:hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.ram-item--warning { color: var(--warning); }
.ram-item--warning:hover { background: color-mix(in srgb, var(--warning) 12%, transparent); }
.ram-item--success { color: var(--success); }
.ram-item--success:hover { background: color-mix(in srgb, var(--success) 12%, transparent); }
.ram-item--info { color: var(--info); }
.ram-item--info:hover { background: color-mix(in srgb, var(--info) 12%, transparent); }
.ram-item--danger { color: var(--danger); }
.ram-item--danger:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); }

.ram-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 6px 4px 4px;
}

.ram-colors {
  display: grid;
  grid-template-columns: repeat(6, 22px);
  gap: 4px;
  justify-content: start;
  margin-bottom: 4px;
  padding: 0 4px;
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
  .ram-popover { animation: none; }
}
</style>
