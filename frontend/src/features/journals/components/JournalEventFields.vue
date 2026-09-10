<template>
  <FormField label="Название" vertical><FormTextInput :value="value.title" aria-label="Название записи" placeholder="Дайте этому моменту имя" :maxlength="255" autofocus @update:value="patch({ title: $event })" /></FormField>
  <template v-if="!['newday', 'header'].includes(value.type)">
    <FormField label="Описание" vertical><InputDescription :value="value.desc" :block="descriptionBlock" editable @update:value="(_id, desc) => patch({ desc })" /></FormField>
    <div v-if="value.type === 'dialog'" class="journal-field-rows">
      <div v-for="(line, index) in value.dialogue" :key="line.id" class="journal-field-row">
        <div class="journal-field-row-head"><span>Реплика {{ index + 1 }}</span><RemoveButton icon="trash" label="Удалить реплику" @click="patch({ dialogue: value.dialogue.filter(row => row.id !== line.id) })" /></div>
        <FormField label="Кто говорит" vertical><FormTextInput :value="line.speaker" aria-label="Кто говорит" placeholder="Имя говорящего" @update:value="updateRow('dialogue', index, { speaker: $event })" /></FormField>
        <FormField label="Реплика" vertical><FormTextarea :value="line.text" aria-label="Текст реплики" placeholder="Что было сказано?" :rows="3" @update:value="updateRow('dialogue', index, { text: $event })" /></FormField>
      </div>
      <button class="journal-field-add" type="button" @click="patch({ dialogue: [...value.dialogue, defaultDialogueLine()] })"><Plus :size="16" /> Реплика</button>
    </div>
    <div v-if="value.type === 'battle'" class="journal-field-rows">
      <div v-for="(creature, index) in value.combatants" :key="creature.id" class="journal-field-row">
        <div class="journal-field-row-head"><span>Участник {{ index + 1 }}</span><RemoveButton icon="trash" label="Удалить участника" @click="patch({ combatants: value.combatants.filter(row => row.id !== creature.id) })" /></div>
        <DndDiaryCombatantFields :value="creature" :items-by-id="itemsById" @update:value="updateRow('combatants', index, $event)" />
      </div>
      <button class="journal-field-add" type="button" @click="patch({ combatants: [...value.combatants, defaultCombatant()] })"><Plus :size="16" /> Участник</button>
    </div>
    <template v-if="value.type === 'quest'">
      <div class="journal-field-rows" role="group" aria-label="Пункты задания">
        <div class="journal-field-row-head"><span>Пункты задания</span></div>
        <div v-for="(objective, index) in value.quest.objectives" :key="objective.id" class="journal-objective-field">
          <CompactCheckbox :model-value="objective.done" :label="objective.text || 'Пункт задания'" @update:model-value="updateObjective(index, { done: $event })" />
          <FormTextarea :value="objective.text" aria-label="Текст пункта" placeholder="Что нужно сделать?" :rows="2" :maxlength="500" @update:value="updateObjective(index, { text: $event })" />
          <RemoveButton icon="trash" label="Удалить пункт" @click="patchQuest({ objectives: value.quest.objectives.filter(row => row.id !== objective.id) })" />
        </div>
        <button v-if="value.quest.objectives.length < 100" class="journal-field-add" type="button" @click="patchQuest({ objectives: [...value.quest.objectives, defaultObjective()] })"><Plus :size="16" /> Пункт задания</button>
      </div>
      <FormField label="Награда" vertical><FormTextarea :value="value.quest.reward" aria-label="Награда" placeholder="Что получат герои?" :rows="2" :maxlength="2000" @update:value="patchQuest({ reward: $event })" /></FormField>
    </template>
  </template>
</template>
<script setup>
import { Plus } from '@lucide/vue'
import { CompactCheckbox, FormField, FormTextInput, FormTextarea, RemoveButton } from '@sylvieshare/share-ui'
import InputDescription from '@/shared/ui/InputDescription.vue'
import DndDiaryCombatantFields from '@/features/character-editor/blocks/dnd/components/DndDiaryCombatantFields.vue'
import { defaultCombatant, defaultDialogueLine } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'
import { defaultObjective } from '../lib/journalQuest'
const props = defineProps({ value: { type: Object, required: true }, itemsById: { type: Map, default: () => new Map() } })
const emit = defineEmits(['update:value'])
const descriptionBlock = { id: 'journal-desc', content: { placeholder: 'Что стоит запомнить?' } }
const patch = change => emit('update:value', { ...props.value, ...change })
const patchQuest = change => patch({ quest: { ...props.value.quest, ...change } })
function updateRow(key, index, change) { patch({ [key]: props.value[key].map((row, i) => i === index ? { ...row, ...change } : row) }) }
function updateObjective(index, change) { patchQuest({ objectives: props.value.quest.objectives.map((row, i) => i === index ? { ...row, ...change } : row) }) }
</script>
<style scoped>
.journal-field-rows { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.journal-field-row { display: flex; flex-direction: column; gap: 14px; min-width: 0; padding-top: 16px; border-top: 1px solid var(--border); }
.journal-field-row-head { display: flex; align-items: center; justify-content: space-between; color: var(--text-muted); font-size: 12px; }
.journal-field-add { display: inline-flex; align-items: center; align-self: flex-start; gap: 7px; padding: 8px 0; border: 0; background: transparent; color: var(--accent-soft); font: 600 12px var(--font-ui); cursor: pointer; }
.journal-objective-field { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.journal-objective-field > :first-child { margin-top: 3px; }
.journal-objective-field > :nth-child(2) { flex: 1; min-width: 0; }
</style>
