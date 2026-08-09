<template>
  <div class="cp-wrap">
    <div class="cp-display-row">
      <div class="cp-display">
        <span class="cp-expr">{{ modelValue || '0' }}</span>
      </div>
      <button class="cp-bksp" @click="backspace" touch-action="manipulation">⌫</button>
      <slot name="append" />
    </div>
    <div class="cp-pad">
      <button v-for="k in ['7','8','9','4','5','6','1','2','3']" :key="k" class="cp-key" @click="append(k)">{{ k }}</button>
      <button class="cp-key cp-key-op" @click="append('+')">+</button>
      <button class="cp-key" @click="append('0')">0</button>
      <button class="cp-key cp-key-op" @click="append('−')">−</button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

function append(ch) {
  const ops = ['+', '−']
  let val = props.modelValue
  if (ops.includes(ch) && ops.includes(val.slice(-1))) {
    val = val.slice(0, -1) + ch
  } else {
    val += ch
  }
  emit('update:modelValue', val)
}

function backspace() {
  emit('update:modelValue', props.modelValue.slice(0, -1))
}
</script>

<style scoped>
.cp-wrap {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cp-display-row {
  display: flex;
  align-items: stretch;
  gap: 6px;
}

.cp-display {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  padding: 6px 12px;
  min-height: 40px;
}

.cp-expr {
  flex: 1;
  font-size: 20px;
  font-weight: bold;
  color: var(--text-1);
  text-align: right;
  word-break: break-all;
  line-height: 1.2;
}

.cp-bksp {
  background: color-mix(in srgb, var(--text-on-accent) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 0 12px;
  border-radius: 8px;
  transition: color 0.12s, background 0.12s;
  touch-action: manipulation;
  flex-shrink: 0;
}
.cp-bksp:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); border-color: color-mix(in srgb, var(--danger) 20%, transparent); }

.cp-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}

.cp-key {
  background: color-mix(in srgb, var(--text-on-accent) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  border-radius: 7px;
  color: var(--text-1);
  font-size: 17px;
  font-weight: 600;
  font-family: inherit;
  padding: 20px 0;
  cursor: pointer;
  line-height: 1;
  transition: background 0.1s;
  touch-action: manipulation;
}
.cp-key:hover  { background: color-mix(in srgb, var(--text-on-accent) 11%, transparent); }
.cp-key:active { background: color-mix(in srgb, var(--text-on-accent) 18%, transparent); }

.cp-key-op {
  color: var(--accent-soft);
  background: color-mix(in srgb, var(--accent-soft) 8%, transparent);
  border-color: color-mix(in srgb, var(--accent-soft) 15%, transparent);
}
.cp-key-op:hover { background: color-mix(in srgb, var(--accent-soft) 18%, transparent); }
</style>
