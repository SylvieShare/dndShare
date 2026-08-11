<template>
  <select
    ref="selectRef"
    class="form-select"
    :value="value"
    @change="onChange"
  >
    <slot />
  </select>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const props = defineProps({
  value: { default: '' },
  autofocus: { type: Boolean, default: false },
})
const emit = defineEmits(['update:value', 'change'])
const selectRef = ref(null)

function onChange(event) {
  const option = event.target.options[event.target.selectedIndex]
  const value = option && '_value' in option ? option._value : event.target.value
  emit('update:value', value)
  emit('change', value)
}

onMounted(() => { if (props.autofocus) selectRef.value?.focus() })
defineExpose({ focus: () => selectRef.value?.focus() })
</script>

<style scoped>
.form-select {
  width: 100%;
  box-sizing: border-box;
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  padding: 9px 12px;
  outline: none;
  transition: border-color 0.15s;
}

.form-select:focus { border-color: var(--accent); }
.form-select:disabled { cursor: not-allowed; opacity: 0.55; }
</style>
