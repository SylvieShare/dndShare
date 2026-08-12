<template>
  <nav ref="navEl" class="sliding-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :ref="el => setBtnRef(el, tab.key)"
      class="sliding-tab"
      :class="{ active: modelValue === tab.key }"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab.key"
      @click="select(tab.key)"
    >
      <img v-if="tab.svg" class="sliding-tab-icon" :src="tab.svg" :alt="tab.title" />
      <span v-else>{{ tab.title }}</span>
    </button>
    <span class="sliding-tab-underline" :style="underlineStyle"></span>
  </nav>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// Reusable desktop tab switcher with a sliding accent underline.
// `tabs`: array of { key, title, svg? }. `modelValue` is the active key.
const props = defineProps({
  tabs: { type: Array, required: true },
  modelValue: { type: [String, Number], default: null },
})
const emit = defineEmits(['update:modelValue'])

const navEl = ref(null)
const btnEls = ref({})
const underline = ref({ left: 0, width: 0, ready: false })

const underlineStyle = computed(() => ({
  transform: `translateX(${underline.value.left}px)`,
  width: `${underline.value.width}px`,
  opacity: underline.value.ready ? 1 : 0,
}))

function setBtnRef(el, key) {
  if (el) btnEls.value[key] = el
}

function select(key) {
  if (key === props.modelValue) return
  emit('update:modelValue', key)
}

function updateUnderline() {
  const el = btnEls.value[props.modelValue]
  if (!el) return
  underline.value = { left: el.offsetLeft, width: el.offsetWidth, ready: true }
}

watch(() => props.modelValue, () => nextTick(updateUnderline))
watch(() => props.tabs, () => nextTick(updateUnderline), { deep: true })

let resizeObserver = null
onMounted(() => {
  nextTick(updateUnderline)
  if (typeof ResizeObserver !== 'undefined' && navEl.value) {
    resizeObserver = new ResizeObserver(() => updateUnderline())
    resizeObserver.observe(navEl.value)
  }
  window.addEventListener('resize', updateUnderline)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', updateUnderline)
})

defineExpose({ updateUnderline })
</script>

<style scoped>
.sliding-tabs {
  position: relative;
  display: flex;
  gap: 24px;
  min-height: 40px;
  padding: 0 20px;
  flex-wrap: nowrap;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  background: transparent;
  box-sizing: border-box;
}

.sliding-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
  border: none;
  border-radius: 0;
  background: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: color 0.15s;
  white-space: nowrap;
}

.sliding-tab:hover {
  color: var(--text-2);
}

.sliding-tab.active {
  color: var(--text-1);
}

/* Sliding indicator — position/width are driven from JS and animate in CSS. */
.sliding-tab-underline {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--accent);
  pointer-events: none;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.2s ease;
}

.sliding-tab-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  opacity: 0.65;
  transition: opacity 0.15s;
}

.sliding-tab.active .sliding-tab-icon {
  opacity: 1;
  filter: brightness(1.3);
}

@media (max-width: 640px) {
  .sliding-tabs {
    gap: 18px;
    padding: 0 16px;
  }

  .sliding-tab {
    font-size: 12px;
  }
}
</style>
