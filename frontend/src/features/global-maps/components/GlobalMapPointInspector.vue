<template>
  <WorkspaceFocusPanel :open="visible && !!point && !!route" :focus-key="point?.id" class="global-map-point-inspector" aria-label="Настройки точки">
    <InspectorContent v-if="point && route">
      <template #heading>
        <header class="global-map-point-heading"><MapPin :size="20" :style="{ color: route.color }" /><h3>{{ point.name || `Точка ${index + 1}` }}</h3><ActionButton icon-only variant="quiet" aria-label="Закрыть настройки точки" @click="emit('close')"><template #icon><X :size="18" /></template></ActionButton></header>
      </template>
      <p class="global-map-point-context">{{ route.name }} · точка {{ index + 1 }} из {{ route.points.length }}</p>
      <small v-if="point.visitCount > 1">Общая точка: изменения отразятся во всех посещениях ({{ point.visitCount }}).</small>
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
      <button v-if="chapter" class="global-map-inspector-chapter" type="button" :aria-label="`Открыть главу: ${chapter.name}`" @click="emit('chapter', chapter)">
        <BaseTile framed class="global-map-chapter-preview"><img v-if="chapter.imageUrl" :src="chapter.imageUrl" alt="" /><BookOpenText v-else :size="28" /><span><small>Глава {{ chapter.number }}</small><strong>{{ chapter.name }}</strong></span></BaseTile>
      </button>
    </InspectorContent>
  </WorkspaceFocusPanel>
</template>
<script setup>
import { computed } from 'vue'
import { ActionButton, BaseTile, FormField, FormSelect, FormTextarea, FormTextInput } from '@sylvieshare/share-ui'
import { ArrowDown, ArrowUp, BookOpenText, MapPin, Trash2, X } from '@lucide/vue'
import WorkspaceFocusPanel from '@/shared/ui/WorkspaceFocusPanel.vue'
import InspectorContent from '@/shared/ui/InspectorContent.vue'
const props = defineProps({ point: Object, route: Object, index: Number, chapters: Array, disabled: Boolean, visible: { type: Boolean, default: true } })
const emit = defineEmits(['change', 'close', 'reorder', 'delete', 'chapter'])
const chapter = computed(() => props.chapters.find(chapter => chapter.id === props.point?.chapterId))
</script>
<style scoped>
.global-map-point-heading { display: flex; align-items: center; gap: 8px; }
.global-map-point-heading > svg { flex: none; }
h3 { margin: 0; flex: 1; min-width: 0; overflow-wrap: anywhere; color: var(--text-1); font-size: 18px; }
.global-map-point-context { margin: 0; font-size: 11px; color: var(--text-muted); }
.global-map-point-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.global-map-point-actions :deep(button:last-child) { color: var(--danger); }
small { font-size: 10px; color: var(--text-muted); line-height: 1.5; }
.global-map-inspector-chapter { width: 100%; border: 0; background: none; padding: 0; color: var(--text-1); font: inherit; cursor: pointer; text-align: left; }
.global-map-chapter-preview { display: flex; gap: 10px; align-items: center; padding: 8px; }
.global-map-chapter-preview img { width: 64px; height: 48px; border-radius: 5px; object-fit: cover; }
.global-map-chapter-preview span { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.global-map-chapter-preview strong { font-size: 12px; overflow-wrap: anywhere; }
</style>
