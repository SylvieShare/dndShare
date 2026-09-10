<template>
  <div class="ability-action-fields">
    <FormField label="Изменять число использований" title="Показывает колонку ресурса. Если ресурс берётся из прогрессии, колонка обязательна.">
      <ToggleSwitch :model-value="uses || !!data.max_use_scaling" :disabled="!!data.max_use_scaling" aria-label="Изменять число использований" @update:model-value="setUses" />
    </FormField>
    <div class="ability-progression-table">
      <table>
        <thead><tr><th>С уровня</th><th>Значение</th><th v-if="uses || data.max_use_scaling">Использований</th><th><span class="sr-only">Удаление</span></th></tr></thead>
        <tbody>
          <tr v-for="(row, index) in data.scaling || []" :key="index">
            <td><FormTextInput :value="row.level" @update:value="value => row.level = numberOrNull(value)" type="number" min="1" max="20" :aria-label="`С уровня, строка ${index + 1}`" title="Уровень выбранного источника расчётов способности. Значение действует до следующей строки." /></td>
            <td><FormTextInput v-model:value="row.value" :aria-label="`Значение, строка ${index + 1}`" placeholder="Например, +2" title="Значение, которое используют эффект и панель на листе." /></td>
            <td v-if="uses || data.max_use_scaling"><FormTextInput :value="row.uses" @update:value="value => row.uses = numberOrNull(value)" type="number" min="0" :aria-label="`Использований, строка ${index + 1}`" title="Максимум использований. 0 — без ограничения." /></td>
            <td><RemoveButton icon="trash" :label="`Удалить изменение с уровня ${row.level}`" @click="pending = { key: 'scaling', index }" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <AddButton label="Добавить изменение" @click="add('scaling')" />
    <details class="ability-advanced" :open="customLabels || hasNotes || undefined">
      <summary>Подпись и примечания</summary>
      <div class="ability-action-fields">
        <FormField label="Своя подпись вместо рассчитанного значения" title="По умолчанию лист показывает текущее значение прогрессии или кости дополнительного урона.">
          <ToggleSwitch :model-value="customLabels" aria-label="Своя подпись вместо рассчитанного значения" @update:model-value="setLabels" />
        </FormField>
        <template v-if="customLabels">
          <div v-for="(row, index) in data.display_scaling || []" :key="index" class="ability-progression-label">
            <FormField label="С уровня" vertical><FormTextInput :value="row.level" @update:value="value => row.level = numberOrNull(value)" type="number" min="1" max="20" :aria-label="`Уровень подписи ${index + 1}`" /></FormField>
            <FormField label="Подпись" vertical><FormTextInput v-model:value="row.label" :aria-label="`Подпись ${index + 1}`" /></FormField>
            <RemoveButton icon="trash" :label="`Удалить подпись с уровня ${row.level}`" @click="pending = { key: 'display_scaling', index }" />
          </div>
          <AddButton label="Добавить подпись" @click="add('display_scaling')" />
        </template>
        <FormField v-for="(row, index) in data.scaling || []" :key="index" :label="`Примечание с уровня ${row.level || '…'}`" vertical title="Пояснение к строке; не участвует в расчётах."><FormTextInput v-model:value="row.note" :aria-label="`Примечание ${index + 1}`" /></FormField>
      </div>
    </details>
    <ConfirmDialog v-if="pending" title="Удалить строку?" message="Изменение применится после сохранения способности." :z-index="(editor.zIndex || 4500) + 300" @confirm="remove" @close="pending = null" @cancel="pending = null" />
  </div>
</template>
<script setup>
import { computed, inject, onScopeDispose, ref, watchEffect } from 'vue'
import { AddButton, ConfirmDialog, FormField, FormTextInput, RemoveButton, ToggleSwitch } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { numberOrNull } from '@/features/handbook/objects/lib/schemaFields'
import { progressionError } from '@/shared/lib/abilityProgression'
const props = defineProps({ data: { type: Object, required: true } })
const editor = inject(itemFieldEditorKey, {})
const uses = ref((props.data.scaling || []).some(row => row.uses != null))
const customLabels = ref(!!props.data.display_scaling?.length), pending = ref(null)
const hasNotes = computed(() => props.data.scaling?.some(row => row.note))
const validationKey = Symbol('progression')
watchEffect(() => editor.setValidationError?.(validationKey, progressionError(props.data)))
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
function setUses(value) { uses.value = value; if (!value) for (const row of props.data.scaling || []) delete row.uses }
function setLabels(value) { customLabels.value = value; props.data.display_scaling = value ? [{ level: Number(props.data.level) || 1, label: '' }] : [] }
function add(key) {
  const rows = props.data[key] || []
  props.data[key] = [...rows, { level: Math.min(20, Math.max(Number(props.data.level) || 1, ...rows.map(row => Number(row.level) + 1 || 1))) }]
}
function remove() { const { key, index } = pending.value; props.data[key].splice(index, 1); pending.value = null }
</script>
