<template>
  <div class="fn-wrap">
    <button type="button" class="fn-btn" tabindex="-1" @click.stop="step(-1)">−</button>
    <input
      class="fn-input"
      type="number"
      :value="value"
      :min="min"
      :max="max"
      @change="onChange"
    />
    <button type="button" class="fn-btn" tabindex="-1" @click.stop="step(1)">+</button>
  </div>
</template>

<script setup>
const props = defineProps({
  value: { default: 0 },
  min:   { default: undefined },
  max:   { default: undefined },
})
const emit = defineEmits(['change'])

function clamp(n) {
  if (props.min != null && n < props.min) return props.min
  if (props.max != null && n > props.max) return props.max
  return n
}

function onChange(e) {
  emit('change', clamp(parseInt(e.target.value) || 0))
}

function step(delta) {
  emit('change', clamp((parseInt(props.value) || 0) + delta))
}
</script>

<style scoped>
.fn-wrap {
  display: flex;
  width: fit-content;
  align-items: center;
  background: var(--surface-raised);
  box-shadow: inset 0 0 0 1px var(--border-strong);
  border-radius: 8px;
  overflow: hidden;
}

.fn-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  font-weight: 700;
  width: 28px;
  height: 36px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.12s, background 0.12s;
  line-height: 1;
  user-select: none;
  touch-action: manipulation;
}
.fn-btn:hover { color: var(--text-2); background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.fn-btn:active { background: color-mix(in srgb, var(--text-on-accent) 12%, transparent); }

.fn-input {
  width: 48px;
  background: none;
  border: none;
  color: var(--text-2);
  font-size: 15px;
  font-weight: 700;
  font-family: inherit;
  text-align: center;
  padding: 0;
  outline: none;
  -moz-appearance: textfield;
}
.fn-input::-webkit-inner-spin-button,
.fn-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>
