<template>
  <div class="roster-selection" aria-label="Выбор участников">
    <div v-if="actionsVisible" class="roster-selection-actions" role="group" aria-label="Действия с выбранными">
      <EncounterChallengeMenu :encounter="encounter" />
      <SessionRosterAction :icon="HeartCrack" :count="selection.damageTargets.length"
        :disabled="!selection.damageTargets.length" :aria-label="`Нанести урон: ${selection.damageTargets.length}`" @click="open('damage')">
        Урон
      </SessionRosterAction>
      <SessionRosterAction v-if="selection.supportsExperience" :icon="Sparkles" :count="selection.experienceTargets.length"
        :disabled="!selection.experienceTargets.length"
        :aria-label="`${encounter.isRed ? 'Добавить IP' : 'Добавить опыт'}: ${selection.experienceTargets.length}`" @click="open('experience')">
        {{ encounter.isRed ? 'IP' : 'Опыт' }}
      </SessionRosterAction>
      <SessionRosterAction :icon="Swords" :count="selection.moveTargets.length" :disabled="!selection.moveTargets.length"
        :aria-label="`${encounter.encounter.active ? 'Ввести в бой' : 'Добавить на сцену'}: ${selection.moveTargets.length}`"
        @click="encounter.sendCombatantsTo(selection.moveTargets, 'combat')">
        <template v-if="encounter.encounter.active">В бой</template>
        <template v-else>На сцену</template>
      </SessionRosterAction>
      <SessionRosterAction v-if="combatWorkspace" :icon="LogOut" :count="selection.returnTargets.length" :disabled="!selection.returnTargets.length"
        :aria-label="`Убрать со сцены: ${selection.returnTargets.length}`" @click="encounter.sendCombatantsTo(selection.returnTargets, 'reserve')">
        Со сцены
      </SessionRosterAction>
      <SessionRosterAction v-if="combatWorkspace" :icon="Skull" :count="deadMoveCount" danger :disabled="!deadMoveCount || encounter.impactBusy"
        title="Отметить выбранных погибшими" aria-label="Отметить выбранных погибшими" @click="encounter.sendSelectedTo('dead')">
        Отметить<br />гибель
      </SessionRosterAction>
      <SessionRosterAction :icon="Trash2" :count="encounter.selectedNpcCount" danger :disabled="!encounter.selectedNpcCount"
        :aria-label="`Удалить НПС: ${encounter.selectedNpcCount}`" aria-keyshortcuts="Backspace"
        :shortcut="showShortcutHints ? '⌫' : undefined" @click="encounter.removeSelectedNpcs">
        Удалить
      </SessionRosterAction>
    </div>
    <span class="roster-count-sr-only" role="status">Выбрано: {{ selection.selected.length }}</span>
    <SessionSelectionSummary :items="selection.selected" :encounter="encounter" />
    <div v-if="actionsVisible || showSelectAll || selection.selected.length" class="roster-selection-heading">
      <label v-if="showSelectAll" class="roster-all-check">
        <CompactCheckbox :model-value="allVisible" :indeterminate="someVisible && !allVisible"
          :size="layoutTokens['roster-checkbox-icon']" :hit-size="layoutTokens['touch-min']"
          :disabled="!encounter.canManageReserves || !visibleRows.length" label="Выбрать всех в этой вкладке"
          @update:model-value="selection.setVisibleSelection(visibleRows, $event)" />
        <span>Все</span>
      </label>
      <ActionButton class="roster-clear-selection" variant="quiet" :disabled="!selection.selected.length" @click="selection.clear">Сбросить выбор</ActionButton>
    </div>
  </div>
  <AppModalFrame v-if="action" :title="action === 'damage' ? 'Нанести урон' : 'Добавить опыт'" close-label="Закрыть" @close="!pending && (action = null)">
    <p class="roster-action-summary">{{ action === 'damage' ? 'Урон каждой выбранной цели' : 'Опыт каждому выбранному персонажу' }} · {{ targets.length }}</p>
    <FormField :label="action === 'damage' ? 'Количество урона' : 'Количество опыта'" vertical>
      <FormNumberInput :value="amount" :min="1" :max="action === 'damage' ? 100000 : 999999999" :disabled="locked" autofocus @change="amount = $event" />
    </FormField>
    <p v-if="error" role="alert" class="roster-action-error">{{ error }}</p>
    <p v-if="plan?.some(row=>row.done)" role="status">Начислено: {{ plan.filter(row=>row.done).length }} / {{ plan.length }}. Повтор затронет только остальных.</p>
    <template #footer><FormActionButtons :submit-text="action === 'damage' ? 'Нанести урон' : 'Добавить опыт'" :can-submit="Number(amount) >= 1 && !pending" :loading="pending" :disabled="pending" @cancel="!pending && (action=null)" @submit="apply" /></template>
  </AppModalFrame>
</template>
<script setup>
import { computed, ref, shallowRef } from 'vue'
import { ActionButton, AppModalFrame, CompactCheckbox, FormActionButtons, FormField, FormNumberInput } from '@sylvieshare/share-ui'
import { HeartCrack, LogOut, Skull, Sparkles, Swords, Trash2 } from '@lucide/vue'
import EncounterChallengeMenu from './EncounterChallengeMenu.vue'
import SessionRosterAction from './SessionRosterAction.vue'
import SessionSelectionSummary from './SessionSelectionSummary.vue'
import { layoutTokens } from '@/app/design-tokens'
import { charactersApi } from '@/shared/api/charactersApi'
import { pvExperiencePath } from '../lib/participantView'
import { experiencePlan, saveExperiencePlan } from '../lib/rosterExperience'
const props = defineProps({
  encounter: { type: Object, required: true },
  selection: { type: Object, required: true },
  visibleItems: { type: Array, default: () => [] },
  actionsVisible: { type: Boolean, default: true },
  showSelectAll: { type: Boolean, default: true },
  combatWorkspace: Boolean,
  showShortcutHints: Boolean,
})
const deadMoveCount = computed(() => props.encounter.selectedToMoveTo('dead'))
const visibleRows=computed(()=>{const ids=new Set(props.selection.items.map(row=>row.uid));return [...new Map(props.visibleItems.filter(row=>ids.has(row.uid)).map(row=>[row.uid,row])).values()]})
const allVisible=computed(()=>visibleRows.value.length>0&&visibleRows.value.every(row=>props.encounter.isSelected(row)))
const someVisible=computed(()=>visibleRows.value.some(row=>props.encounter.isSelected(row)))
const action=ref(null),amount=ref(1),pending=ref(false),error=ref(''),locked=ref(false),targets=shallowRef([]),plan=ref(null)
function open(kind) {
  targets.value=[...(kind==='damage'?props.selection.damageTargets:props.selection.experienceTargets)]
  action.value=kind;amount.value=1;error.value='';locked.value=false;plan.value=null
}
async function apply() {
  const value=Math.floor(Number(amount.value))
  if(pending.value || !Number.isSafeInteger(value) || value<1)return
  pending.value=true;error.value='';locked.value=true
  try {
    if(action.value==='damage')await props.encounter.applyDamageToCombatants(targets.value,value)
    else {
      plan.value ??= experiencePlan(targets.value.map(row=>{const participant=props.encounter.findParticipant(row.charId);return {participant,path:pvExperiencePath(participant)}}),value)
      await saveExperiencePlan(plan.value,charactersApi.patchData)
    }
    action.value=null
  } catch(reason) {error.value=reason?.message || 'Не удалось применить действие'}
  finally {pending.value=false}
}
</script>
<style scoped>
.roster-selection {min-width:0}
.roster-selection-heading {display:flex;align-items:center;flex-wrap:wrap;gap:var(--spacing-xs)}
.roster-count-sr-only {position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.roster-action-summary {font-size:var(--type-caption-size);color:var(--text-muted)}
.roster-all-check {display:inline-flex;align-items:center;gap:var(--spacing-small);min-height:var(--layout-touch-min);margin-inline-start:var(--spacing-medium);cursor:pointer}
.roster-clear-selection { margin-inline-start: auto; }
.roster-selection-actions {
  --action-min: calc(var(--layout-touch-min) + var(--spacing-large));
  --action-fourth: calc((100% - 3 * var(--spacing-xs)) / 4);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, max(var(--action-min), var(--action-fourth))), 1fr));
  gap: var(--spacing-xs);
  padding-block-start: var(--spacing-xs);
}
.roster-action-error { color: var(--danger); }
</style>
