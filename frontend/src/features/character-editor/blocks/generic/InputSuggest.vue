<template>
  <div class="suggest-wrap">
    <SuggestPicker
      v-model="query"
      class="input-suggest-picker"
      :suggest-type-id="block.content.suggest_id"
      :placeholder="charCtx.ownerMode ? (block.content.placeholder || 'Поиск...') : ''"
      :readonly="!charCtx.ownerMode"
      :invalid="!query && charCtx.ownerMode"
    />
  </div>
</template>

<script setup>
import { inject, ref, watch } from 'vue'
import SuggestPicker from '@/shared/ui/SuggestPicker'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true, dictionaries: {}, var: {} })
const query = ref(props.value || '')

watch(() => props.value, v => {
  if (v !== query.value) query.value = v || ''
})
watch(query, v => {
  emit('update:value', props.block.id, v)
})
</script>

<style scoped>
.suggest-wrap {
  min-width: 50px;
}

.input-suggest-picker {
  min-width: 90px;
  width: fit-content;
  max-width: 260px;
  font-size: 18px;
}

.input-suggest-picker :deep(.sp-trigger),
.input-suggest-picker :deep(.sp-input) {
  min-height: 32px;
  font-size: 18px;
  background: transparent;
}

.input-suggest-picker :deep(.sp-trigger:disabled) {
  color: var(--text-1);
}
</style>
