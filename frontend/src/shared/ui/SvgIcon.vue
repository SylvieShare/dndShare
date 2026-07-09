<template>
  <span
    v-if="svg"
    class="svg-icon"
    :style="iconStyle"
    v-html="svg"
    aria-hidden="true"
  />
</template>

<script setup>
import { computed } from 'vue'
import { svgColorFilter } from '@/shared/lib/svgColorFilter'

const props = defineProps({
  // Inline SVG markup (e.g. a suggest's / item-type's `svg` field).
  svg: { type: String, default: '' },
  // Target color. Applied as CSS `color` (for `currentColor` svgs) by default,
  // or as a recolor `filter` when `filter` is true (for fixed-fill svgs).
  color: { type: String, default: null },
  // Use the svgColorFilter recolor technique instead of `color`/currentColor.
  filter: { type: Boolean, default: false },
  // Optional square size in px (number) or any CSS length (string). When omitted,
  // size is controlled by the class passed from the caller.
  size: { type: [Number, String], default: null },
})

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
</style>
