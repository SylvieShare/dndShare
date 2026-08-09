<template>
  <div class="slider" :class="{ 'slider--disabled': disabled }">
    <div ref="trackEl" class="slider-track" @pointerdown="onPointerDown">
      <div class="slider-fill" :style="{ width: pct + '%' }" />
      <div class="slider-thumb" :style="{ left: pct + '%' }" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 1 },
  step: { type: Number, default: 0.01 },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'change'])

const trackEl = ref(null)

const pct = computed(() => {
  const range = props.max - props.min
  if (!range) return 0
  return Math.max(0, Math.min(100, ((props.modelValue - props.min) / range) * 100))
})

function valueFromEvent(e) {
  if (!trackEl.value) return props.modelValue
  const rect = trackEl.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const raw = props.min + ratio * (props.max - props.min)
  const stepped = Math.round(raw / props.step) * props.step
  return Math.max(props.min, Math.min(props.max, Number(stepped.toFixed(6))))
}

function onPointerDown(e) {
  if (props.disabled) return
  e.preventDefault()
  const v = valueFromEvent(e)
  emit('update:modelValue', v)
  const onMove = (ev) => {
    emit('update:modelValue', valueFromEvent(ev))
  }
  const onUp = (ev) => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    emit('change', valueFromEvent(ev))
  }
  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}
</script>

<style scoped>
.slider {
  display: flex;
  align-items: center;
  height: 18px;
  flex: 1;
  min-width: 0;
  user-select: none;
}
.slider--disabled { opacity: 0.4; pointer-events: none; }

.slider-track {
  position: relative;
  flex: 1;
  height: 4px;
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  border-radius: 2px;
  cursor: pointer;
}
.slider-track:hover { background: color-mix(in srgb, var(--text-on-accent) 9%, transparent); }

.slider-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--accent);
  border-radius: 2px;
}

.slider-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: var(--accent);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  transition: box-shadow 0.15s;
}
.slider-track:hover .slider-thumb { box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 25%, transparent); }
</style>
