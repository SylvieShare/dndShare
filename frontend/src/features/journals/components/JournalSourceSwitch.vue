<template>
  <div class="journal-source-switch">
    <MultiToggle
      :model-value="journal?.kind || 'personal'"
      :options="options"
      :disabled="busy"
      aria-label="Источник дневника"
      @update:model-value="selectKind"
    />
    <label v-if="journal?.kind === 'session' && sessionSources.length > 1" class="journal-session-select">
      <span>Сессия</span>
      <FormSelect :value="journal.uuid" :disabled="busy" @update:value="$emit('select', $event)">
        <option v-for="source in sessionSources" :key="source.uuid" :value="source.uuid">
          {{ source.sessionName || source.name }}
        </option>
      </FormSelect>
    </label>
    <small v-else-if="!sessionSources.length">Дневник сессии появится, когда мастер создаст его для вашей группы.</small>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { FormSelect, MultiToggle } from '@sylvieshare/share-ui'

const props = defineProps({
  journal: { type: Object, default: null },
  sources: { type: Array, default: () => [] },
  busy: Boolean,
})
const emit = defineEmits(['select', 'create-personal'])
const sessionSources = computed(() => props.sources.filter(source => source.kind === 'session'))
const options = computed(() => [
  { value: 'personal', label: 'Личный' },
  { value: 'session', label: 'Сессии', disabled: !sessionSources.value.length },
])

function selectKind(kind) {
  const source = props.sources.find(item => item.kind === kind)
  if (source) emit('select', source.uuid)
  else if (kind === 'personal') emit('create-personal')
}
</script>

<style scoped>
.journal-source-switch { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.journal-source-switch > small { max-width: 320px; color: var(--text-muted); font-size: 10px; line-height: 1.5; }
.journal-session-select { display: flex; min-width: 0; align-items: center; gap: 8px; color: var(--text-muted); font-size: 10px; }
.journal-session-select :deep(select) { max-width: 280px; }
@media (max-width: 720px) {
  .journal-session-select { width: 100%; }
  .journal-session-select :deep(select) { max-width: 100%; }
}
</style>
