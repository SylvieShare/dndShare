<template>
  <Teleport to="body">
    <Transition :name="transition">
      <div
        v-if="open"
        ref="popoverEl"
        class="app-dropdown base-popover"
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
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open:      { type: Boolean, default: false },
  anchor:    { type: [Object, null], default: null },
  placement: { type: String, default: 'bottom-start' },
  offset:    { type: Number, default: 6 },
  minWidth:  { type: Number, default: 160 },
  zIndex:    { type: Number, default: 0 },
  transition: { type: String, default: '' },
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
  if (props.zIndex) style.zIndex = props.zIndex
  switch (props.placement) {
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
  if (anchorEl()?.contains(e.target)) return
  close()
}

function onKey(e) {
  if (e.key === 'Escape') close()
}

watch(() => props.open, (val) => {
  if (val) {
    compute()
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
  } else {
    document.removeEventListener('pointerdown', onDocPointerDown, true)
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', close)
    window.removeEventListener('scroll', close, true)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', close, true)
})
</script>

<style scoped>
.base-popover {
  /* Inherits .app-dropdown from App.vue */
  min-width: 160px;
}
</style>
