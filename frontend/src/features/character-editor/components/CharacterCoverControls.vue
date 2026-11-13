<template>
  <RowActionMenu v-if="coverState.foldable" title="Внешний экран">
    <template #trigger="{ open }">
      <ActionButton :variant="automatic ? 'secondary' : 'quiet'" aria-label="Настройка внешнего экрана" aria-haspopup="menu" :aria-expanded="open">
        <template #icon><PanelsTopLeft :size="16" aria-hidden="true" /></template>Автопоказ
      </ActionButton>
    </template>
    <template #default="{ close }">
      <ToggleSwitch block surface="raised" track-placement="end" label="Автоматический показ" :model-value="automatic" :disabled="!automatic && (!coverState.available || !photos.length)" @update:model-value="toggle" />
      <p class="cover-controls-hint">Плавная смена раз в минуту. Фотографии подбираются под ориентацию внешнего экрана.</p>
      <p v-if="coverState.loading && coverState.autoOwner === owner" class="cover-controls-hint" role="status">Подготавливаем фотографию…</p>
      <p v-if="!coverState.available" class="cover-controls-hint">{{ coverState.reason }}</p>
      <p v-else-if="!photos.length" class="cover-controls-hint">Добавьте фотографии в галерею.</p>
      <p v-if="error || nativeError" class="cover-controls-error" role="alert">{{ error || nativeError }}</p>
      <RowActionItem v-if="coverState.owner === owner && coverState.selected || coverState.autoOwner === owner && coverState.autoplay" :icon="PanelTopClose" @click="stop(); close()">Убрать с внешнего экрана</RowActionItem>
    </template>
  </RowActionMenu>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ActionButton, RowActionItem, RowActionMenu, ToggleSwitch } from '@sylvieshare/share-ui'
import { PanelsTopLeft, PanelTopClose } from '@lucide/vue'
import { coverState, startCoverSlideshow, pauseCoverSlideshow, stopCover } from '@/platform/coverDisplay'
const props = defineProps({ owner: { type: String, required: true }, photos: { type: Array, default: () => [] } })
const error = ref('')
const automatic = computed(() => coverState.autoplay && coverState.autoOwner === props.owner)
const nativeError = computed(() => coverState.autoOwner === props.owner ? coverState.error : '')
async function toggle(enabled) {
  error.value = ''
  try {
    if (enabled) await startCoverSlideshow(props.owner, props.photos)
    else await pauseCoverSlideshow(props.owner)
  } catch (problem) { error.value = problem.message || 'Не удалось включить показ' }
}
async function stop() { try { await stopCover(props.owner) } catch (problem) { error.value = problem.message } }
</script>
<style scoped>
.cover-controls-hint {max-width:270px;margin:var(--spacing-small);color:var(--text-muted);font-size:var(--type-context-size);line-height:1.4}
.cover-controls-error {max-width:270px;margin:var(--spacing-small);color:var(--danger);font-size:var(--type-context-size)}
</style>
