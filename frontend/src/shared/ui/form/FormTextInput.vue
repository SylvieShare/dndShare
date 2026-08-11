<template>
  <input
    ref="inputRef"
    class="form-text-input"
    :class="{ 'form-text-input--mono': mono, 'form-text-input--invalid': invalid }"
    :type="type"
    :value="value"
    :placeholder="placeholder"
    :maxlength="maxlength"
    :autocomplete="autocomplete"
    @input="$emit('update:value', $event.target.value)"
    @change="$emit('change', $event.target.value)"
    @keydown.enter="$emit('enter', $event)"
  />
</template>

<script setup>
import { onMounted, ref } from 'vue'

const props = defineProps({
  value:        { default: '' },
  type:         { type: String, default: 'text' },
  placeholder:  { type: String, default: '' },
  maxlength:    { default: undefined },
  autocomplete: { type: String, default: 'off' },
  mono:         { type: Boolean, default: false },
  autofocus:    { type: Boolean, default: false },
  invalid:      { type: Boolean, default: false },
})
defineEmits(['update:value', 'change', 'enter'])

const inputRef = ref(null)
onMounted(() => { if (props.autofocus) inputRef.value?.focus() })
defineExpose({ focus: () => inputRef.value?.focus() })
</script>

<style scoped>
.form-text-input {
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  padding: 9px 12px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.form-text-input:focus { border-color: var(--accent); }
.form-text-input--invalid { border-color: var(--danger); }
.form-text-input:disabled { cursor: not-allowed; opacity: 0.55; }
.form-text-input::placeholder { color: var(--text-muted); }
.form-text-input--mono { font-family: monospace; font-size: 13px; }
</style>
