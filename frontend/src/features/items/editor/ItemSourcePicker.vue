<template>
  <div class="item-source-picker">
    <button type="button" class="ability-source-trigger" title="Книги и публикации, из которых взята запись. Можно выбрать несколько." @click="open = true">
      <BookOpen :size="15" /><span><small>Источник</small>{{ summary }}</span><Pencil :size="13" />
    </button>
    <AppModalFrame v-if="open" title="Источники публикации" :z-index="zIndex" @close="open = false">
      <p class="ability-block-hint">Выберите книги, в которых опубликована запись. Личные материалы можно оставить без публикации.</p>
      <FormTextInput v-model:value="search" aria-label="Поиск источника" placeholder="Название книги или код…" />
      <div class="ability-source-options">
        <ToggleSwitch v-for="source in filteredSources" :key="source.id" :label="`${source.name}${source.code ? ` · ${source.code}` : ''}`" :title="source.description || source.name" :model-value="selected(source.id)" @update:model-value="toggle(source.id)" />
        <p v-if="!filteredSources.length">Источники не найдены.</p>
      </div>
      <template #footer><button type="button" class="ability-link" @click="open = false">Готово</button></template>
    </AppModalFrame>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { AppModalFrame, FormTextInput, ToggleSwitch } from '@sylvieshare/share-ui'
import { BookOpen, Pencil } from '@lucide/vue'
const props = defineProps({ zIndex: { type: Number, default: 4700 }, sources: { type: Array, default: () => [] }, modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const open = ref(false)
const search = ref('')
const selected = id => props.modelValue.some(value => String(value) === String(id))
const summary = computed(() => {
  const sources = props.sources.filter(source => selected(source.id))
  if (!sources.length) return 'Без публикации'
  return sources.length === 1 ? sources[0].name : `${sources[0].name} и ещё ${sources.length - 1}`
})
const filteredSources = computed(() => props.sources.filter(source => `${source.name} ${source.code || ''}`.toLocaleLowerCase('ru').includes(search.value.toLocaleLowerCase('ru'))))
function toggle(id) { emit('update:modelValue', selected(id) ? props.modelValue.filter(value => String(value) !== String(id)) : [...props.modelValue, id]) }
</script>
