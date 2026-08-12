<template>
  <div
    class="slabel"
    :class="{ 'slabel--border': border && !divider, 'slabel--divider': divider }"
    :style="alignStyle"
  >
    <span class="slabel-text">{{ title }}</span>
    <span v-if="divider" class="slabel-line" aria-hidden="true" />
    <slot name="actions" />
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Uppercase block label shared by plain titles and bordered headers (was three
// near-identical components: BlockTitle / BlockHeader / SectionHeader). Pass
// `border` for the underlined header variant and use the #actions slot for a
// trailing control (collapse button etc). `align` centers/right-aligns the text.
const props = defineProps({
  title: { type: String, default: '' },
  border: { type: Boolean, default: false },
  divider: { type: Boolean, default: false },
  align: { type: String, default: '' },
})

const alignStyle = computed(() => {
  const map = { left: 'flex-start', center: 'center', right: 'flex-end' }
  return props.align && map[props.align] ? { justifyContent: map[props.align] } : {}
})
</script>

<style scoped>
.slabel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}

.slabel--border {
  padding-bottom: 5px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 6px;
}

.slabel--divider {
  gap: 12px;
  margin-bottom: 14px;
  color: var(--text-2);
  font-size: 11px;
  letter-spacing: 0.08em;
}

.slabel--divider .slabel-text {
  flex: 0 0 auto;
}

.slabel-line {
  min-width: 24px;
  height: 1px;
  flex: 1 1 auto;
  background: color-mix(in srgb, var(--text-muted) 32%, transparent);
}
</style>
