<template>
  <ConfirmDialog
    :title="copy.title"
    :message="copy.message"
    confirm-label="Удалить"
    :loading="loading"
    @cancel="$emit('cancel')"
    @confirm="$emit('confirm')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'

const props = defineProps({
  request: { type: Object, required: true },
  loading: { type: Boolean, default: false },
})
defineEmits(['cancel', 'confirm'])

const copy = computed(() => {
  const value = props.request
  if (value.kind === 'edge') return { title: 'Удалить связь?', message: 'Связь между карточками будет удалена.' }
  if (value.kind === 'scene') return { title: 'Удалить сценарий?', message: `«${value.scene.name}» и все его блоки будут удалены.` }
  if (value.kind === 'selection' && value.level === 'scenes') {
    return { title: `Удалить сценарии: ${value.ids.length}?`, message: 'Выбранные сценарии, их блоки и связанные переходы будут удалены.' }
  }
  if (value.kind === 'selection') {
    return { title: `Удалить блоки: ${value.ids.length}?`, message: 'Выбранные блоки и связанные переходы будут удалены. Действие нельзя отменить.' }
  }
  return { title: 'Удалить блок?', message: `«${value.block.title || 'Без названия'}» — действие нельзя отменить.` }
})
</script>
