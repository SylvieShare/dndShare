<template>
  <AppModalFrame wide title="Источники персонажа" @close="$emit('close')">
    <p class="csm-copy">
      Выбранные книги ограничивают новые варианты в справочниках. Уже добавленный контент останется на листе.
    </p>
    <ContentSourceSelector
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

<style scoped>
.csm-copy {
  margin: 0;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.5;
}
</style>
