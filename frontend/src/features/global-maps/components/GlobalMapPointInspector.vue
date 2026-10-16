<template>
  <BaseTile class="global-map-point-inspector" aria-label="Настройки точки">
    <header><strong>Точка {{ index + 1 }} · {{ route.name }}</strong><ActionButton icon-only variant="quiet" aria-label="Закрыть настройки точки" @click="emit('close')"><template #icon><X :size="18" /></template></ActionButton></header>
    <FormField label="Название" vertical><FormTextInput :value="point.name" :maxlength="100" :disabled="disabled" aria-label="Название точки" @update:value="emit('change', { name: $event })" /></FormField>
    <FormField label="Глава" vertical><FormSelect :value="point.chapterId || ''" :disabled="disabled" aria-label="Привязать точку к главе" @change="emit('change', { chapterId: Number($event) || null })">
      <option value="">Без привязки</option><option v-for="chapter in chapters" :key="chapter.id" :value="chapter.id">{{ chapter.number }}. {{ chapter.name }}</option>
    </FormSelect></FormField>
    <FormField label="Заметка на карте" vertical><FormTextarea :value="point.note" :rows="3" :maxlength="2000" :disabled="disabled" placeholder="Место встречи, опасный перевал…" aria-label="Заметка точки" @update:value="emit('change', { note: $event })" /></FormField>
    <div class="global-map-point-actions">
      <ActionButton variant="secondary" :disabled="disabled || index === 0" aria-label="Передвинуть точку раньше" @click="emit('reorder', -1)"><template #icon><ArrowUp :size="16" /></template>Раньше</ActionButton>
      <ActionButton variant="secondary" :disabled="disabled || index === route.points.length - 1" aria-label="Передвинуть точку позже" @click="emit('reorder', 1)"><template #icon><ArrowDown :size="16" /></template>Позже</ActionButton>
      <ActionButton variant="quiet" :disabled="disabled" aria-label="Удалить точку" @click="emit('delete')"><template #icon><Trash2 :size="16" /></template></ActionButton>
    </div>
    <small>Перетащите точку на карте. Стрелки двигают выделенную точку, Delete удаляет.</small>
  </BaseTile>
</template>
<script setup>
import { ActionButton, BaseTile, FormField, FormSelect, FormTextarea, FormTextInput } from '@sylvieshare/share-ui'
import { ArrowDown, ArrowUp, Trash2, X } from '@lucide/vue'
defineProps({ point: Object, route: Object, index: Number, chapters: Array, disabled: Boolean })
const emit = defineEmits(['change', 'close', 'reorder', 'delete'])
</script>
<style scoped>
.global-map-point-inspector { position: absolute; z-index: 8; right: 16px; bottom: 16px; width: min(320px, calc(100% - 32px)); max-height: calc(100% - 100px); overflow: auto; display: flex; flex-direction: column; gap: 10px; padding: 14px; box-shadow: var(--shadow-lg); }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
header strong { color: var(--text-1); font-size: 12px; }
.global-map-point-actions { display: flex; align-items: center; gap: 6px; }
small { font-size: 10px; color: var(--text-muted); line-height: 1.5; }
@media (max-width: 760px) { .global-map-point-inspector { right: 10px; bottom: 10px; max-height: 48%; width: calc(100% - 20px); } }
</style>
