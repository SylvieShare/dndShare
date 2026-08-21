<template>
  <div v-if="fields.length" class="instance-params">
    <FormField v-for="field in fields" :key="field.key" :label="field.name" vertical>
      <input
        v-if="field.type === 'int'"
        class="instance-param-input"
        type="number"
        :min="field.min"
        :max="field.max"
        :value="modelValue?.[field.key] ?? field.default ?? ''"
        @input="setValue(field, $event.target.value)"
      />
      <select
        v-else-if="field.type === 'select'"
        class="instance-param-input"
        :value="modelValue?.[field.key] ?? field.default ?? ''"
        @change="setValue(field, $event.target.value)"
      >
        <option v-for="option in field.options || []" :key="option.value" :value="option.value">{{ option.label || option.value }}</option>
      </select>
    </FormField>
  </div>
</template>

<script setup>
import { FormField } from '@sylvieshare/share-ui'
import { normalizeInstanceParams } from '@/features/items/lib/itemInstance'

const props = defineProps({
  fields: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue'])

function setValue(field, rawValue) {
  const value = field.type === 'int' ? Number(rawValue) : rawValue
  emit('update:modelValue', normalizeInstanceParams({ ...props.modelValue, [field.key]: value }, props.fields, { defaults: true }))
}
</script>

<style scoped>
.instance-params { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.instance-param-input { width: 100%; height: 34px; box-sizing: border-box; padding: 0 9px; border: 1px solid var(--border-strong); border-radius: 7px; outline: none; background: var(--surface-raised); color: var(--text-1); font: inherit; font-size: 13px; }
.instance-param-input:focus { border-color: var(--accent); }
@media (max-width: 520px) { .instance-params { grid-template-columns: 1fr; } }
</style>
