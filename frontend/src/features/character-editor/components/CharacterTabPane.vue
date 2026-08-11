<template>
  <TemplateBlockInner
    v-for="(block, index) in blocks"
    :key="index"
    :block="block"
    :values="values"
    :vars="vars"
    @update:value="$emit('update:value', $event)"
    @update:var="$emit('update:var', $event)"
  />
</template>

<script setup>
import TemplateBlockInner from '@/features/character-editor/components/TemplateBlockInner.vue'

defineProps({
  tabIndex: { type: Number, required: true },
  blocks: { type: Array, default: () => [] },
  values: { type: Object, default: () => ({}) },
  vars: { type: Object, default: () => ({}) },
})
defineEmits(['update:value', 'update:var'])
</script>
