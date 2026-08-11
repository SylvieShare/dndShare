<template>
  <div ref="rootEl" class="mt-toggle" :class="{ 'mt-toggle--block': block }">
    <div
      class="mt-toggle-pill"
      :class="{
        'mt-toggle-pill--neutral': isNeutralActive,
        'mt-toggle-pill--instant': !pill.animate,
      }"
      :style="pillStyle"
    />
    <button
      v-for="(opt, i) in options"
      :key="opt.value"
      :ref="el => setBtnRef(el, i)"
      type="button"
      class="mt-toggle-btn"
      :class="{
        'mt-toggle-btn--active': opt.value === modelValue,
        'mt-toggle-btn--active-neutral': opt.value === modelValue && opt.value === neutralValue,
      }"
      @click="select(opt.value)"
    >{{ opt.label }}</button>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  options: { type: Array, required: true },
  modelValue: { default: null },
  block: { type: Boolean, default: false },
  neutralValue: { default: undefined },
})

const isNeutralActive = computed(
  () => props.neutralValue !== undefined && props.modelValue === props.neutralValue,
)
const emit = defineEmits(['update:modelValue'])

const rootEl = ref(null)
const btnEls = ref([])
const pill = ref({ left: 0, width: 0, ready: false, animate: false })

function setBtnRef(el, i) { btnEls.value[i] = el }

let restoreAnimationFrame = null

function measure(animate = false) {
  const idx = props.options.findIndex(o => o.value === props.modelValue)
  const el = btnEls.value[idx]
  if (!el) {
    pill.value = { left: 0, width: 0, ready: false, animate: false }
    return
  }
  pill.value = { left: el.offsetLeft, width: el.offsetWidth, ready: true, animate }

  // A morph editor continuously resizes while opening. ResizeObserver used to start a new
  // 240 ms pill transition on every animation frame, so the highlight visibly chased the
  // buttons. Geometry updates caused by layout must be instant; only an actual selection
  // change should animate.
  if (!animate && typeof requestAnimationFrame !== 'undefined') {
    if (restoreAnimationFrame != null) cancelAnimationFrame(restoreAnimationFrame)
    restoreAnimationFrame = requestAnimationFrame(() => {
      restoreAnimationFrame = null
      pill.value = { ...pill.value, animate: true }
    })
  }
}

let ro = null
onMounted(async () => {
  await nextTick()
  measure()
  if (typeof ResizeObserver !== 'undefined' && rootEl.value) {
    ro = new ResizeObserver(() => measure(false))
    ro.observe(rootEl.value)
  }
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  if (restoreAnimationFrame != null) cancelAnimationFrame(restoreAnimationFrame)
})

watch(() => props.modelValue, async () => { await nextTick(); measure(true) })
watch(() => props.options.length, async () => { await nextTick(); measure(false) })

function select(v) {
  if (v !== props.modelValue) emit('update:modelValue', v)
}

const pillStyle = computed(() => ({
  transform: `translateX(${pill.value.left}px)`,
  width: pill.value.width + 'px',
  opacity: pill.value.ready ? 1 : 0,
}))
</script>

<style scoped>
.mt-toggle {
  position: relative;
  display: inline-flex;
  width: fit-content;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 3px;
}
.mt-toggle--block { display: flex; width: 100%; }

.mt-toggle-pill {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 0;
  background: var(--accent);
  border-radius: 6px;
  transition: transform 0.24s cubic-bezier(0.4, 0, 0.2, 1),
              width 0.24s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.18s ease;
  pointer-events: none;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 35%, transparent);
}
.mt-toggle-pill--instant { transition: none; }

.mt-toggle-btn {
  position: relative;
  z-index: 1;
  background: none;
  border: none;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-2);
  padding: 6px 14px;
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.18s;
  white-space: nowrap;
}
.mt-toggle--block .mt-toggle-btn { flex: 1; }

.mt-toggle-btn:hover { color: var(--text-1); }
.mt-toggle-btn--active { color: var(--text-on-accent); }

.mt-toggle-pill--neutral {
  background: color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  box-shadow: none;
}
.mt-toggle-btn--active-neutral { color: var(--text-1); }
</style>
