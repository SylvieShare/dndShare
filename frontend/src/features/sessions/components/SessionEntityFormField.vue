<template>
      <template v-if="header">
        <span v-if="field.input === 'color'" class="session-header-color">
          <ColorPresetPicker v-if="editable" :model-value="draft.color" allow-custom aria-label="Цвет карточки" custom-label="Свой цвет" :z-index="9300" @update:model-value="changeColor" />
          <i v-else :style="{ background: draft.color }" aria-label="Цвет карточки" />
        </span>
        <InlineEdit v-else :model-value="draft[field.key]" :display-value="displayValue(field) ?? (draft[field.key] || field.label)" :label="field.label" :placeholder="field.placeholder || field.label"
          :edit-label="`Редактировать поле «${field.label}»`" confirm-label="Сохранить" cancel-label="Отменить" error-label="Не удалось сохранить"
          :editable="editable" :force-open="editing" :disabled="saving || busy || uploading || (field.input === 'race' && racesLoading)"
          :options="inlineOptions" :required="!!field.required" :maxlength="field.maxlength || 0"
          :persist="value => saveField(field.key, value)" @update:model-value="updateField(field.key, $event)" />
        <button v-if="field.key === 'name' && type === 'npc' && editing" type="button" class="session-entity-random-name" aria-label="Случайное имя" @click="draft.name = randomDndName(selectedRace, Math.random, draft.name)"><Dices :size="16" /></button>
      </template>
      <SessionEditableField v-else
        :model-value="draft[field.key]"
        :label="field.label" :placeholder="field.placeholder || field.label"
        :icon="field.icon"
        :display-value="displayValue(field)"
        :editable="editable"
        :force-open="editing"
        :multiline="!!field.multiline"
        :rows="field.rows || 4"
        :maxlength="field.maxlength || 0"
        :required="!!field.required"
        :wide="!!field.wide"
        :saving="saving || busy || uploading"
        :persist="value => saveField(field.key, value)"
        @update:model-value="updateField(field.key, $event)"
      >
        <template v-if="field.input === 'bestiary'" #editor="{ value, update }">
          <div class="session-entity-reference-input">
            <AddButton :label="value ? 'Сменить существо' : 'Выбрать существо'" @click="openBestiary(update)" />
            <RemoveButton v-if="value" icon="trash" label="Убрать привязку к бестиарию" @click="update('')" />
            <span>{{ referenceNames[value] || (Number(value) === Number(entity?.bestiaryItemId) ? entity?.bestiaryItemName : '') || (value ? `Существо #${value}` : 'Не выбрано') }}</span>
          </div>
        </template>
        <template v-if="field.input === 'bestiary'" #display><SessionBestiaryReference :item-id="draft.bestiaryItemId" :fallback-name="displayValue(field)" /></template>
        <template v-else-if="type === 'material' && ['content', 'asset'].includes(field.key)" #display>
          <SessionMaterialPreview :material="entity" />
        </template>
      </SessionEditableField>
</template>
<script setup>
import { computed, onBeforeUnmount, toRefs, watch } from 'vue'
import { Dices } from '@lucide/vue'
import { AddButton, ColorPresetPicker, InlineEdit, RemoveButton } from '@sylvieshare/share-ui'
import SessionEditableField from './SessionEditableField.vue'
import SessionBestiaryReference from './SessionBestiaryReference.vue'
import SessionMaterialPreview from './SessionMaterialPreview.vue'
import { randomDndName } from '@/shared/lib/dndNames'
import { useSessionEntityForm } from '../lib/sessionEntityFormContext'
const props = defineProps({ field: { type: Object, required: true }, header: Boolean })
const form = useSessionEntityForm()
const { type, entity, editing, editable, saving } = toRefs(form.props)
const { error, draft, busy, uploading, raceOptions, racesLoading, referenceNames, selectedRace, displayValue, saveField, updateField, openBestiary } = form
const inlineOptions = computed(() => props.field.input === 'race'
  ? [{ value: '', label: 'Раса не выбрана' }, ...raceOptions.value.map(option => ({ value: option.key, label: option.label }))]
  : props.field.options?.map(option => ({ value: option.key, label: option.label })) || null)
let pendingColor = null
let savingColor = false
onBeforeUnmount(() => { pendingColor = null })
function changeColor(value) {
  if (!value) return
  if (editing.value) { updateField('color', value); return }
  pendingColor = value
  flushColor()
}
watch([busy, saving], flushColor)
async function flushColor() {
  if (savingColor || saving.value || busy.value || !pendingColor) return
  const value = pendingColor; pendingColor = null; savingColor = true
  try { await saveField('color', value) }
  catch (cause) { error.value = cause.message || 'Не удалось сохранить цвет' }
  finally { savingColor = false; if (pendingColor) flushColor() }
}
</script>
<style scoped>
.session-entity-reference-input { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.session-entity-random-name { display: grid; place-items: center; padding: 5px; border: 0; background: transparent; color: var(--accent); cursor: pointer; }
.session-header-color { display: inline-flex; align-items: center; height: 32px; }
.session-header-color i { display: block; width: 22px; height: 22px; border-radius: var(--r-sm); }
</style>
