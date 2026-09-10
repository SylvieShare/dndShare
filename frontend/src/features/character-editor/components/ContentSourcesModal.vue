<template>
  <AppModalFrame wide title="Источники персонажа" @close="$emit('close')">
    <ContentSourceSelector
      embedded
      :source-version-id="sourceVersionId"
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </AppModalFrame>
</template>

<script setup>
import ContentSourceSelector from '@/features/character-editor/components/ContentSourceSelector.vue'
import { AppModalFrame } from '@sylvieshare/share-ui'

defineProps({
  sourceVersionId: { type: [Number, String], default: null },
  modelValue: { type: [Object, Array], default: null },
})

defineEmits(['close', 'update:modelValue'])
</script>
