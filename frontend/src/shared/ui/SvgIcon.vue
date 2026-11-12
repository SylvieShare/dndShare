<template>
  <span
    v-if="svg"
    class="svg-icon"
    :style="iconStyle"
    v-html="svg"
    aria-hidden="true"
  />
  <span v-else-if="svgId" class="svg-icon svg-icon--asset" :style="[iconStyle, assetStyle]" aria-hidden="true">
    <SkeletonBlock v-if="loading" width="100%" height="100%" />
  </span>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { SkeletonBlock } from '@sylvieshare/share-ui'
import { svgColorFilter } from '@/shared/lib/svgColorFilter'
import { loadSvgAsset, rememberSvgAsset } from '@/shared/lib/svgAsset'

const props = defineProps({
  // Inline SVG markup (e.g. a suggest's / item-type's `svg` field).
  svg: { type: String, default: '' },
  svgId: { type: [Number, String], default: null },
  // Target color. Applied as CSS `color` (for `currentColor` svgs) by default,
  // or as a recolor `filter` when `filter` is true (for fixed-fill svgs).
  color: { type: String, default: null },
  // Use the svgColorFilter recolor technique instead of `color`/currentColor.
  filter: { type: Boolean, default: false },
  // Optional square size in px (number) or any CSS length (string). When omitted,
  // size is controlled by the class passed from the caller.
  size: { type: [Number, String], default: null },
})

const assetUrl = ref(''), loading = ref(false)
let generation = 0
function releaseAsset() { if (assetUrl.value) URL.revokeObjectURL(assetUrl.value); assetUrl.value = '' }
async function loadAsset() {
  const current = ++generation
  releaseAsset()
  loading.value = !props.svg && !!props.svgId
  if (props.svg && props.svgId) { await rememberSvgAsset(props.svgId, props.svg); return }
  if (!loading.value) return
  try {
    const svg = await loadSvgAsset(props.svgId)
    if (current === generation) assetUrl.value = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  } catch { /* The label remains usable; an online event retries a missing asset. */ }
  finally { if (current === generation) loading.value = false }
}
function retryAsset() { if (!props.svg && props.svgId && !assetUrl.value && !loading.value) void loadAsset() }
watch([() => props.svgId, () => props.svg], (_next, _previous, onCleanup) => {
  if (props.svgId && !props.svg) {
    window.addEventListener('online', retryAsset)
    onCleanup(() => window.removeEventListener('online', retryAsset))
  }
  void loadAsset()
}, { immediate: true })
onBeforeUnmount(() => { generation++; releaseAsset() })
const assetStyle = computed(() => assetUrl.value ? {
  maskImage: `url("${assetUrl.value}")`, WebkitMaskImage: `url("${assetUrl.value}")`,
  backgroundColor: props.color || 'currentColor', filter: 'none',
} : {})

const iconStyle = computed(() => {
  const style = {}
  if (props.size != null) {
    style.width = style.height = typeof props.size === 'number' ? `${props.size}px` : props.size
  }
  if (props.filter) {
    if (props.color) style.filter = svgColorFilter(props.color)
  } else if (props.color) {
    style.color = props.color
  }
  return style
})
</script>

<style scoped>
.svg-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}
.svg-icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.svg-icon--asset {mask-position:center;mask-size:contain;mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:contain;-webkit-mask-repeat:no-repeat}
</style>
