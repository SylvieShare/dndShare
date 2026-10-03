<template>
  <div ref="canvas" class="money-morph-preview" :class="{ 'money-morph-preview--revealed': expanded }" :style="layout">
    <BlockMoneyView class="money-morph-copy" panel inline morph-preview :loading="loading" :coins="coins" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useIsMobile } from '@sylvieshare/share-ui'
import BlockMoneyView from './BlockMoneyView.vue'

const props = defineProps({
  originEl: Object, originRect: Object, revealed: Boolean, loading: Boolean,
  viewWidth: { type: Number, default: 300 }, coins: { type: Array, default: () => [] },
})
const canvas = ref(null)
const expanded = ref(false)
const mobile = useIsMobile()
const viewportWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)
const source = reactive({
  width: props.originRect?.width || 0, height: props.originRect?.height || 0,
  top: 0, right: 0, bottom: 0, borderLeft: 0, borderTop: 0,
})
const pixels = value => Number.parseFloat(value) || 0

function measure() {
  const origin = props.originEl
  if (!origin) return
  const rect = origin.getBoundingClientRect()
  const content = origin.querySelector('.money-content')
  const style = getComputedStyle(content || origin)
  const sheet = canvas.value?.closest('.ms-sheet')
  const sheetStyle = sheet ? getComputedStyle(sheet) : null
  Object.assign(source, {
    width: rect.width, height: rect.height,
    top: pixels(style.paddingTop) + pixels(style.borderTopWidth),
    right: pixels(style.paddingRight) + pixels(style.borderRightWidth),
    bottom: pixels(style.paddingBottom) + pixels(style.borderBottomWidth),
    borderLeft: pixels(sheetStyle?.borderLeftWidth), borderTop: pixels(sheetStyle?.borderTopWidth),
  })
}

const width = computed(() => mobile.value ? viewportWidth.value : Math.min(props.viewWidth, viewportWidth.value - 32))
const layout = computed(() => ({
  '--wallet-origin-width': `${source.width}px`,
  '--wallet-preview-width': `${width.value}px`,
  '--wallet-preview-height': `${source.height + Math.max(0, 16 - source.top) + Math.max(0, 16 - source.bottom)}px`,
  '--wallet-start-x': `${-source.borderLeft}px`,
  '--wallet-start-y': `${-source.borderTop}px`,
  '--wallet-end-x': `${width.value - source.width - 18 + source.right}px`,
  '--wallet-end-y': `${16 - source.top}px`,
}))

let observer
function onResize() { viewportWidth.value = window.innerWidth; measure() }
measure()
onMounted(async () => {
  measure()
  observer = new ResizeObserver(measure)
  if (props.originEl) observer.observe(props.originEl)
  window.addEventListener('resize', onResize)
  // Start with the container morph, rather than the secondary-content reveal 20ms later.
  await nextTick()
  if (!canvas.value) return
  void canvas.value.offsetWidth
  expanded.value = true
})
watch(() => props.revealed, (value, previous) => { if (previous && !value) expanded.value = false })
watch(() => props.coins, measure, { deep: true, flush: 'post' })
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.money-morph-preview { position: relative; width: var(--wallet-preview-width); height: var(--wallet-preview-height); }
.money-morph-copy { width: var(--wallet-origin-width); transform: translate(var(--wallet-start-x), var(--wallet-start-y)); transition: transform 300ms cubic-bezier(.2, 0, 0, 1); }
.money-morph-preview--revealed .money-morph-copy { transform: translate(var(--wallet-end-x), var(--wallet-end-y)); transition-duration: 420ms; }
</style>
