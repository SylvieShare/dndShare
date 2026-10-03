<template>
  <AppModalFrame title="Добавить в дневник" @close="!saving && $emit('close')">
    <LoadingState v-if="loading" label="Загружаем сессии…" />
    <template v-else>
      <p class="scenario-journal__block">{{ block.title || 'Элемент сценария' }}</p>
      <FormField v-if="occurrences.length" label="Сессия" vertical>
        <FormSelect v-model:value="selectedId" :disabled="saving" aria-label="Сессия для записи в дневник">
          <option v-for="row in occurrences" :key="row.id" :value="row.id">#{{ row.number }} · {{ row.name }} · {{ occurrenceDate(row.date) }}</option>
        </FormSelect>
      </FormField>
      <p v-else>Сначала создайте сессию в календаре кампании.</p>
      <p v-if="error || saveError" role="alert" class="scenario-journal__error">{{ saveError || error }}</p>
      <button v-if="error" type="button" @click="load()">Повторить загрузку</button>
    </template>
    <template #footer><FormActionButtons submit-text="Добавить" :loading="saving" :disabled="saving" :can-submit="Boolean(selectedId) && !loading" @submit="save" @cancel="$emit('close')" /></template>
  </AppModalFrame>
</template>
<script setup>
import { ref, watch } from 'vue'
import { AppModalFrame, FormActionButtons, FormField, FormSelect, LoadingState } from '@sylvieshare/share-ui'
import { appendScenarioJournalItem } from '@/shared/api/journalsApi'
import { useSessionOccurrences } from '../composables/useSessionOccurrences'
import { localDate, occurrenceDate } from '../lib/sessionOccurrences'
const props = defineProps({ sessionUuid: { type: String, required: true }, block: { type: Object, required: true } })
const emit = defineEmits(['close'])
const { occurrences, loading, error, load } = useSessionOccurrences(props.sessionUuid)
const selectedId = ref(''), saving = ref(false), saveError = ref('')
watch(occurrences, rows => {
  if (rows.some(row => row.id === Number(selectedId.value))) return
  selectedId.value = rows.filter(row => row.date && row.date <= localDate()).at(-1)?.id || rows[0]?.id || ''
})
async function save() {
  if (saving.value || !selectedId.value) return
  saving.value = true; saveError.value = ''
  try { await appendScenarioJournalItem(props.sessionUuid, props.block.id, Number(selectedId.value)); emit('close') }
  catch (reason) { saveError.value = reason.message || 'Не удалось добавить запись' }
  finally { saving.value = false }
}
</script>
<style scoped>
.scenario-journal__block { margin: 0 0 18px; color: var(--text-1); font-weight: 600; }
.scenario-journal__error { color: var(--danger); font-size: 13px; }
</style>
