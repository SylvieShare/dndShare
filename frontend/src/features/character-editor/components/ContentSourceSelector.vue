<template>
  <div class="css">
    <ToggleSwitch
      :model-value="settings.mode === 'all'"
      label="Использовать все источники"
      @update:model-value="setUseAll"
    />

    <p v-if="settings.mode !== 'all' && loading" class="css-empty">Загрузка источников…</p>
    <p v-else-if="settings.mode !== 'all' && !sources.length" class="css-empty">Для этой редакции источники пока не заведены.</p>

    <div v-else-if="settings.mode !== 'all'" class="css-list">
      <button
        v-for="source in sources"
        :key="source.id"
        type="button"
        class="css-source"
        :class="{ selected: selected(source.id) }"
        @click="toggle(source.id)"
      >
        <span class="css-check">
          <svg v-if="selected(source.id)" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </span>
        <span class="css-copy">
          <span class="css-head">
            <b>{{ source.name }}</b>
            <small>{{ source.code }}</small>
            <em v-if="source.compatibilityStatus === 'legacy'">Legacy</em>
            <em v-else-if="source.compatibilityStatus === 'compatible'">Совместим</em>
          </span>
          <span v-if="source.description" class="css-desc">{{ plainDescription(source.description) }}</span>
        </span>
      </button>
    </div>

    <label v-if="hasLegacy" class="css-legacy">
      <input type="checkbox" :checked="settings.allowLegacy" @change="setLegacy($event.target.checked)" />
      <span><b>Показывать Legacy-контент</b><small>Старые версии опций, для которых существуют обновлённые правила.</small></span>
    </label>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { contentSourcesApi, normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'
import ToggleSwitch from '@/shared/ui/ToggleSwitch'

const props = defineProps({
  sourceVersionId: { type: [Number, String], default: null },
  modelValue: { type: Object, default: () => ({ mode: 'all', ids: [], allowLegacy: false }) },
})
const emit = defineEmits(['update:modelValue', 'loaded'])

const sources = ref([])
const loading = ref(false)
const settings = computed(() => normalizeContentSourceSettings(props.modelValue))
const hasLegacy = computed(() => sources.value.some((source) => source.compatibilityStatus === 'legacy'))

function update(patch) {
  emit('update:modelValue', { ...settings.value, ...patch })
}
function setUseAll(useAll) {
  const mode = useAll ? 'all' : 'selected'
  const patch = { mode }
  if (mode === 'selected' && !settings.value.ids.length) {
    patch.ids = sources.value.filter((source) => source.isDefault && source.compatibilityStatus !== 'legacy').map((source) => source.id)
  }
  update(patch)
}
function selected(id) { return settings.value.ids.some((value) => String(value) === String(id)) }
function toggle(id) {
  const ids = selected(id)
    ? settings.value.ids.filter((value) => String(value) !== String(id))
    : [...settings.value.ids, id]
  update({ ids })
}
function setLegacy(allowLegacy) { update({ allowLegacy }) }
function plainDescription(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function load() {
  if (props.sourceVersionId == null) { sources.value = []; return }
  loading.value = true
  try {
    const res = await contentSourcesApi.listForVersion(props.sourceVersionId)
    sources.value = res?.sources || []
    emit('loaded', sources.value)
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.sourceVersionId, load)
</script>

<style scoped>
.css { display: flex; flex-direction: column; gap: 12px; }
.css-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 8px; }
.css-source { display: flex; gap: 10px; text-align: left; border: 1px solid transparent; border-radius: var(--r-md); background: var(--surface); color: var(--text-1); padding: 11px 12px; cursor: pointer; }
.css-source.selected { border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
.css-check { width: 18px; height: 18px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid var(--border-strong); border-radius: 5px; margin-top: 1px; }
.css-source.selected .css-check { color: var(--text-on-accent); background: var(--accent); border-color: var(--accent); }
.css-check svg { width: 13px; height: 13px; }
.css-copy { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.css-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.css-head b { font-size: 13px; }
.css-head small { color: var(--text-muted); font-size: 10px; }
.css-head em { font-style: normal; font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--accent); }
.css-desc { color: var(--text-muted); font-size: 11px; line-height: 1.4; }
.css-empty { margin: 0; color: var(--text-muted); font-size: 12px; }
.css-legacy { display: flex; align-items: flex-start; gap: 9px; color: var(--text-1); font-size: 12px; cursor: pointer; }
.css-legacy span { display: flex; flex-direction: column; gap: 2px; }
.css-legacy small { color: var(--text-muted); font-size: 11px; }
</style>
