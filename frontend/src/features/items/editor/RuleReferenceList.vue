<template>
  <div class="ability-rule-rows">
    <div v-for="(key, index) in modelValue" :key="key" class="ability-reference">
      <RuleReferencePicker :kind="kind" :value="key" :label="label" @pick="entry => replace(index, entry.key)" />
      <RemoveButton icon="trash" :label="`Убрать ${key}`" @click="emit('update:modelValue', modelValue.filter((_, i) => i !== index))" />
    </div>
    <RuleReferencePicker :kind="kind" :label="`Добавить: ${label}`" @pick="entry => emit('update:modelValue', [...new Set([...modelValue, entry.key])])" />
  </div>
</template>
<script setup>
import { RemoveButton } from '@sylvieshare/share-ui'
import RuleReferencePicker from './RuleReferencePicker.vue'
const props = defineProps({ modelValue: { type: Array, default: () => [] }, kind: String, label: String })
const emit = defineEmits(['update:modelValue'])
function replace(index, key) { emit('update:modelValue', [...new Set(props.modelValue.map((old, i) => index === i ? key : old))]) }
</script>
