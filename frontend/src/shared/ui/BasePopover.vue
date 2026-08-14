<template>
  <Teleport to="body">
    <Transition :name="transition">
      <div
        v-if="open"
        ref="popoverEl"
        :class="['app-dropdown', 'base-popover', popoverClass]"
        :style="positionStyle"
        @click.stop
        @pointerdown.stop
      >
        <slot :close="close" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { closeOpenRowActionSubmenu } from '@/shared/ui/rowActionSubmenuState'

const props = defineProps({
  open:      { type: Boolean, default: false },
  anchor:    { type: [Object, null], default: null },
  placement: { type: String, default: 'bottom-start' },
  offset:    { type: Number, default: 6 },
  minWidth:  { type: Number, default: 160 },
  zIndex:    { type: Number, default: 0 },
  transition: { type: String, default: '' },
  popoverClass: { type: [String, Array, Object], default: '' },
})
const emit = defineEmits(['update:open'])

const popoverEl = ref(null)
const positionStyle = ref(null)

function anchorEl() {
  const a = props.anchor
  if (!a) return null
  if (typeof a.getBoundingClientRect === 'function') return a
  return a.value ?? a
}

function compute() {
  const el = anchorEl()
  if (!el) return
  const rect = el.getBoundingClientRect()
  const style = { position: 'fixed', minWidth: props.minWidth + 'px' }
  const viewportWidth = window.visualViewport?.width || window.innerWidth
  const viewportHeight = window.visualViewport?.height || window.innerHeight
  const popoverWidth = Math.max(props.minWidth, popoverEl.value?.offsetWidth || 0)
  const popoverHeight = popoverEl.value?.offsetHeight || 0
  if (props.zIndex) style.zIndex = props.zIndex
  switch (props.placement) {
    case 'right-start': {
      const rightLeft = rect.right + props.offset
      const leftLeft = rect.left - props.offset - popoverWidth
      const fitsRight = rightLeft + popoverWidth <= viewportWidth - 8
      const fitsLeft = leftLeft >= 8
      const resolvedLeft = fitsRight
        ? rightLeft
        : fitsLeft
          ? leftLeft
          : Math.max(8, Math.min(rightLeft, viewportWidth - popoverWidth - 8))
      style.left = resolvedLeft + 'px'
      style.top = Math.max(8, Math.min(rect.top, viewportHeight - popoverHeight - 8)) + 'px'
      break
    }
    case 'bottom-end':
      style.top = (rect.bottom + props.offset) + 'px'
      style.right = (window.innerWidth - rect.right) + 'px'
      break
    case 'bottom-start':
    default:
      style.top = (rect.bottom + props.offset) + 'px'
      style.left = Math.max(8, Math.min(rect.left, window.innerWidth - props.minWidth - 8)) + 'px'
      break
  }
  positionStyle.value = style
}

function close() {
  emit('update:open', false)
}

function onDocPointerDown(e) {
  if (popoverEl.value?.contains(e.target)) return
  if (e.target?.closest?.('.row-action-submenu-popover')) return
  if (anchorEl()?.contains(e.target)) return
  close()
}

function onScroll(e) {
  // A scrollable popover (the handbook filter on mobile, for example) emits a
  // captured scroll event while the user is interacting with its contents.
  // Keep that interaction inside the popover; only an outside/page scroll
  // invalidates the anchor position and should dismiss it.
  if (popoverEl.value?.contains(e.target)) return
  if (e.target?.closest?.('.row-action-submenu-popover')) return
  close()
}

function onKey(e) {
  if (e.key !== 'Escape') return
  if (closeOpenRowActionSubmenu()) return
  const openPopovers = [...document.querySelectorAll('.base-popover')]
  if (openPopovers.at(-1) !== popoverEl.value) return
  close()
}

watch(() => props.open, async (val) => {
  if (val) {
    compute()
    await nextTick()
    if (!props.open) return
    compute()
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', onScroll, true)
  } else {
    document.removeEventListener('pointerdown', onDocPointerDown, true)
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', close)
    window.removeEventListener('scroll', onScroll, true)
  }
}, { immediate: true })

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', onScroll, true)
})
</script>

<style scoped>
.base-popover {
  /* Inherits .app-dropdown from App.vue */
  min-width: 160px;
}
</style>
