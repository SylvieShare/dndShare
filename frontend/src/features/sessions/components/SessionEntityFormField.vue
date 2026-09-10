<template>
      <SessionEditableField
        :model-value="draft[field.key]"
        :compact="header"
        :headline="header && field.key === 'name'"
        :label="field.label"
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
        <template v-if="field.key === 'name' && type === 'npc' && editing" #actions>
          <button type="button" class="session-entity-random-name" aria-label="Случайное имя" @click="draft.name = randomDndName(selectedRace, Math.random, draft.name)"><Dices :size="16" /></button>
        </template>
        <template v-if="field.input !== 'text'" #editor="{ value, update }">
          <FormSelect v-if="field.input === 'select' || field.input === 'race'" :value="value" :disabled="saving || busy || (field.input === 'race' && racesLoading)" @update:value="update($event)">
            <option v-if="field.input === 'race'" value="">Не выбрана</option>
            <option v-for="option in field.input === 'race' ? raceOptions : field.options" :key="option.key" :value="option.key">{{ option.label }}</option>
          </FormSelect>
          <ColorPresetPicker v-else-if="field.input === 'color'" inline allow-custom :model-value="value" @update:model-value="update($event || '#7c5cff')" />
          <div v-else-if="field.input === 'bestiary'" class="session-entity-reference-input">
            <AddButton :label="value ? 'Сменить существо' : 'Выбрать существо'" @click="openBestiary(update)" />
            <RemoveButton v-if="value" icon="trash" label="Убрать привязку к бестиарию" @click="update('')" />
            <span>{{ referenceNames[value] || (Number(value) === Number(entity?.bestiaryItemId) ? entity?.bestiaryItemName : '') || (value ? `Существо #${value}` : 'Не выбрано') }}</span>
          </div>
        </template>
        <template v-if="type === 'material' && ['content', 'asset'].includes(field.key)" #display>
          <SessionMaterialPreview :material="entity" />
        </template>
        <template v-else-if="field.input === 'color'" #display><span class="session-entity-color-value"><i :style="{ background: draft.color }" />{{ draft.color }}</span></template>
      </SessionEditableField>
</template>
<script setup>
import { toRefs } from 'vue'
import { Dices } from '@lucide/vue'
import { AddButton, ColorPresetPicker, FormSelect, RemoveButton } from '@sylvieshare/share-ui'
import SessionEditableField from './SessionEditableField.vue'
import SessionMaterialPreview from './SessionMaterialPreview.vue'
import { randomDndName } from '@/shared/lib/dndNames'
import { useSessionEntityForm } from '../lib/sessionEntityFormContext'
defineProps({ field: { type: Object, required: true }, header: Boolean })
const form = useSessionEntityForm()
const { type, entity, editing, editable, saving } = toRefs(form.props)
const { draft, busy, uploading, raceOptions, racesLoading, referenceNames, selectedRace, displayValue, saveField, updateField, openBestiary } = form
</script>
<style scoped>
.session-entity-color-value, .session-entity-reference-input { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.session-entity-color-value i { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--border); }
.session-entity-random-name { display: grid; place-items: center; padding: 5px; border: 0; background: transparent; color: var(--accent); cursor: pointer; }
</style>
