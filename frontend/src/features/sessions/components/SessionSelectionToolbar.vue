<template>
  <div class="roster-selection" aria-label="Выбор участников">
    <span class="roster-count-sr-only" role="status">Выбрано: {{ selection.selected.length }}</span>
    <div class="roster-selection-top">
      <SessionSelectionSummary :items="selection.selected" :encounter="encounter" />
      <div v-if="actionsVisible" class="roster-actions">
        <RowActionMenu ref="menu" title="Действия с выбранными" follow-anchor :disabled="!hasActions">
          <template #trigger="{ open }">
            <ActionButton class="roster-actions-trigger" variant="secondary" :disabled="!hasActions" aria-haspopup="menu" :aria-expanded="open">
              <template #icon><ListFilter :size="16" aria-hidden="true" /></template>
              Действия
            </ActionButton>
          </template>
          <template #default="{ close }">
            <EncounterChallengeMenu v-if="canChallenge" :encounter="encounter" :targets="challengeTargets" @done="close" />
            <RowActionItem v-if="selection.damageTargets.length" :icon="HeartCrack"
              :aria-label="`Нанести урон: ${selection.damageTargets.length}`" @click="close(); open('damage')">
              Нанести урон<template #suffix><SessionActionTargets :items="selection.damageTargets" :encounter="encounter" /></template>
            </RowActionItem>
            <RowActionItem v-if="selection.experienceTargets.length" :icon="Sparkles"
              :aria-label="`${encounter.isRed ? 'Добавить IP' : 'Добавить опыт'}: ${selection.experienceTargets.length}`"
              @click="close(); open('experience')">
              {{ encounter.isRed ? 'Добавить IP' : 'Добавить опыт' }}<template #suffix><SessionActionTargets :items="selection.experienceTargets" :encounter="encounter" /></template>
            </RowActionItem>
            <RowActionItem v-if="selection.moveTargets.length" :icon="Swords"
              :aria-label="`${encounter.encounter.active ? 'Ввести в бой' : 'Добавить на сцену'}: ${selection.moveTargets.length}`"
              @click="encounter.sendCombatantsTo(selection.moveTargets, 'combat'); close()">
              {{ encounter.encounter.active ? 'Ввести в бой' : 'Добавить на сцену' }}
              <template #suffix><SessionActionTargets :items="selection.moveTargets" :encounter="encounter" /></template>
            </RowActionItem>
            <RowActionItem v-if="canReturn" :icon="LogOut"
              :aria-label="`Убрать со сцены: ${selection.returnTargets.length}`" @click="encounter.sendCombatantsTo(selection.returnTargets, 'reserve'); close()">
              Убрать со сцены<template #suffix><SessionActionTargets :items="selection.returnTargets" :encounter="encounter" /></template>
            </RowActionItem>
            <RowActionItem v-if="canMarkDefeated" :icon="Skull" tone="danger"
              aria-label="Отметить выбранных погибшими" @click="encounter.sendSelectedTo('dead'); close()">
              Отметить гибель<template #suffix><SessionActionTargets :items="defeatedTargets" :encounter="encounter" /></template>
            </RowActionItem>
            <RowActionItem v-if="npcTargets.length" action="delete" tone="danger"
              :aria-label="`Удалить НПС: ${encounter.selectedNpcCount}`" aria-keyshortcuts="Backspace" @click="encounter.removeSelectedNpcs(); close()">
              Удалить НПС
              <template #suffix>
                <SessionActionTargets :items="npcTargets" :encounter="encounter" />
                <kbd v-if="showShortcutHints" aria-hidden="true">⌫</kbd>
              </template>
            </RowActionItem>
          </template>
        </RowActionMenu>
        <ActionButton v-if="encounter.challengeActive && !encounter.challengeBusy" class="roster-actions-trigger"
          variant="quiet" @click="encounter.resetChallenge()">Убрать испытание</ActionButton>
      </div>
    </div>
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
import { computed, ref, shallowRef, watch } from 'vue'
import { ActionButton, AppModalFrame, CompactCheckbox, FormActionButtons, FormField, FormNumberInput, RowActionMenu } from '@sylvieshare/share-ui'
import { HeartCrack, ListFilter, LogOut, Skull, Sparkles, Swords } from '@lucide/vue'
import EncounterChallengeMenu from './EncounterChallengeMenu.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import SessionActionTargets from './SessionActionTargets.vue'
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
const menu = ref(null)
const challengeTargets = computed(() => props.encounter.selectedChallengeTargets)
const defeatedTargets = computed(() => props.selection.selected.filter(actor => props.encounter.willMoveToGroup(actor, 'dead')))
const npcTargets = computed(() => props.selection.selected.filter(actor => actor.type === 'npc'))
const canChallenge = computed(() => !props.encounter.challengeBusy && !props.encounter.challengeActive && challengeTargets.value.length > 0)
const canReturn = computed(() => props.combatWorkspace && props.selection.returnTargets.length > 0)
const canMarkDefeated = computed(() => props.combatWorkspace && !props.encounter.impactBusy && defeatedTargets.value.length > 0)
const hasActions = computed(() => canChallenge.value || canReturn.value || canMarkDefeated.value
  || props.selection.damageTargets.length > 0 || props.selection.experienceTargets.length > 0
  || props.selection.moveTargets.length > 0 || npcTargets.value.length > 0)
watch(hasActions, available => { if (!available) menu.value?.close() })
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
.roster-selection-top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--spacing-xs);
}
.roster-selection-top .roster-selection-summary { flex: 1 1 112px; }
.roster-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-xs);
  max-inline-size: 100%;
  margin-inline-start: auto;
}
.roster-actions-trigger {
  margin-block-start: var(--spacing-xs);
  padding-inline: var(--spacing-small);
  white-space: nowrap;
}
.roster-action-error { color: var(--danger); }
</style>
