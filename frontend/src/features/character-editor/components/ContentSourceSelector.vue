<template>
  <div class="source-selector">
    <LoadingState v-if="loading" class="source-hint" label="Загрузка источников…" compact />
    <p v-else-if="!sources.length" class="source-hint">Для этой редакции источники пока не заведены.</p>
    <ItemSourcePicker
      v-else
      :embedded="embedded"
      :sources="sources"
      :model-value="settings.ids"
      :use-all="settings.mode === 'all'"
      title="Источники персонажа"
      hint="Выберите книги, из которых доступны варианты персонажа. Уже добавленный контент останется на листе."
      empty-label="Источники не выбраны"
      @update:model-value="update({ mode: 'selected', ids: $event })"
      @select-all="update({ mode: $event ? 'all' : 'selected', ids: [] })"
    >
      <div v-if="hasLegacy" class="source-legacy">
        <ToggleSwitch label="Показывать Legacy-контент" :model-value="settings.allowLegacy" @update:model-value="update({ allowLegacy: $event })" />
        <small>Старые версии опций, для которых существуют обновлённые правила.</small>
      </div>
    </ItemSourcePicker>
  </div>
</template>

<script setup>
import { LoadingState } from '@sylvieshare/share-ui'
import { computed, ref, watch } from 'vue'
import { ToggleSwitch } from '@sylvieshare/share-ui'
import { contentSourcesApi, normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'
import ItemSourcePicker from '@/features/items/editor/ItemSourcePicker.vue'

const props = defineProps({
  sourceVersionId: { type: [Number, String], default: null },
  modelValue: { type: Object, default: () => ({ mode: 'all', ids: [], allowLegacy: false }) },
  embedded: Boolean,
})
const emit = defineEmits(['update:modelValue', 'loaded'])
const sources = ref([])
const loading = ref(false)
const settings = computed(() => normalizeContentSourceSettings(props.modelValue))
const hasLegacy = computed(() => sources.value.some(source => source.compatibilityStatus === 'legacy'))
function update(patch) {
  emit('update:modelValue', { ...settings.value, ...patch })
}
watch(() => props.sourceVersionId, async (versionId, _, onCleanup) => {
  let stale = false
  onCleanup(() => { stale = true })
  sources.value = []
  loading.value = versionId != null
  if (versionId == null) return
  try {
    const res = await contentSourcesApi.listForVersion(versionId)
    if (!stale) {
      sources.value = res?.sources || []
      emit('loaded', sources.value)
    }
  } finally {
    if (!stale) loading.value = false
  }
}, { immediate: true })
</script>

<style scoped>
.source-hint { margin: 0; color: var(--text-muted); font-size: 12px; }
.source-legacy { display: flex; flex-direction: column; gap: 6px; }
.source-legacy small { color: var(--text-muted); font-size: 11px; }
</style>
