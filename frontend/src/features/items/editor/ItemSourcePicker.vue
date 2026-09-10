<template>
  <div class="item-source-picker">
    <button v-if="!embedded" type="button" class="ability-source-trigger" :title="hint" @click="open = true">
      <BookOpen :size="15" /><span><small>Источник</small>{{ summary }}</span><Pencil :size="13" />
    </button>
    <component :is="embedded ? 'div' : AppModalFrame" v-if="embedded || open" :title="embedded ? undefined : title" :z-index="embedded ? undefined : zIndex" @close="open = false">
      <p class="ability-block-hint">{{ hint }}</p>
      <FormTextInput v-model:value="search" aria-label="Поиск источника" placeholder="Название книги или код…" />
      <div class="source-select-all">
        <CompactCheckbox label="Выбрать все" :model-value="allSelected" :aria-checked="someSelected && !allSelected ? 'mixed' : allSelected" :disabled="!sources.length" @update:model-value="selectAll" />
        <button type="button" class="source-select-all-label" :disabled="!sources.length" @click="selectAll(!allSelected)">Выбрать все <small>{{ selectedCount }} / {{ sources.length }}</small></button>
      </div>
      <div class="ability-source-options">
        <ToggleSwitch v-for="source in filteredSources" :key="source.id" :label="sourceLabel(source)" :title="source.description || source.name" :model-value="selected(source.id)" @update:model-value="toggle(source.id)" />
        <p v-if="!filteredSources.length">Источники не найдены.</p>
      </div>
      <slot />
      <template #footer><button type="button" class="ability-link" @click="open = false">Готово</button></template>
    </component>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { AppModalFrame, CompactCheckbox, FormTextInput, ToggleSwitch } from '@sylvieshare/share-ui'
import { BookOpen, Pencil } from '@lucide/vue'
import { isSourceSelected, selectAllSources, toggleSourceSelection } from './sourceSelection'
const props = defineProps({
  zIndex: { type: Number, default: 4700 },
  sources: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] },
  embedded: Boolean,
  useAll: Boolean,
  title: { type: String, default: 'Источники публикации' },
  hint: { type: String, default: 'Выберите книги, в которых опубликована запись. Личные материалы можно оставить без публикации.' },
  emptyLabel: { type: String, default: 'Без публикации' },
})
const emit = defineEmits(['update:modelValue', 'select-all'])
const open = ref(false)
const search = ref('')
const selected = id => isSourceSelected(props.modelValue, id, props.useAll)
const allSelected = computed(() => props.useAll || (props.sources.length > 0 && props.sources.every(source => selected(source.id))))
const someSelected = computed(() => props.sources.some(source => selected(source.id)))
const selectedCount = computed(() => props.sources.filter(source => selected(source.id)).length)
const summary = computed(() => {
  const sources = props.sources.filter(source => selected(source.id))
  if (props.useAll) return 'Все источники'
  if (!sources.length) return props.emptyLabel
  return sources.length === 1 ? sources[0].name : `${sources[0].name} и ещё ${sources.length - 1}`
})
const filteredSources = computed(() => props.sources.filter(source => `${source.name} ${source.code || ''}`.toLocaleLowerCase('ru').includes(search.value.toLocaleLowerCase('ru'))))
function sourceLabel(source) {
  const status = { legacy: 'Legacy', compatible: 'Совместим' }[source.compatibilityStatus]
  return [source.name, source.code, status].filter(Boolean).join(' · ')
}
function toggle(id) {
  emit('update:modelValue', toggleSourceSelection(props.sources, props.modelValue, id, props.useAll))
}
function selectAll(checked) {
  emit('update:modelValue', selectAllSources(props.sources, checked))
  emit('select-all', checked)
}
</script>
<style scoped>
.ability-source-trigger { display: flex; align-items: center; gap: 10px; border: 0; background: none; padding: 8px 0; font: inherit; color: var(--text-2); cursor: pointer; text-align: left; width: 100%; }
.ability-source-trigger > span { flex: 1; min-width: 0; font-size: 12px; }
.ability-source-trigger small { display: block; margin-bottom: 3px; color: var(--text-muted); font-size: 10px; }
.ability-source-trigger:hover { color: var(--accent); }
.ability-block-hint { color: var(--text-muted); font-size: 12px; line-height: 1.45; }
.ability-source-options { display: flex; flex-direction: column; gap: 12px; margin: 16px 0; }
.source-select-all { display: flex; align-items: center; gap: 9px; margin-top: 14px; color: var(--text-1); font-size: 12px; cursor: pointer; }
.source-select-all-label { border: 0; background: none; padding: 0; color: inherit; font: inherit; cursor: pointer; }
.source-select-all small { margin-left: 6px; color: var(--text-muted); }
</style>
