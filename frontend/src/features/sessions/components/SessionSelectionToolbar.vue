<template>
  <div class="roster-selection" :aria-label="label">
    <div v-if="actionsVisible" class="roster-actions-reveal roster-actions-reveal--open">
      <div class="roster-actions-clip"><div class="roster-selection-actions" role="group" aria-label="Действия с выбранными">
        <ActionButton variant="quiet" layout="stacked" :disabled="!selection.damageTargets.length" :aria-label="`Нанести урон: ${selection.damageTargets.length}`" @click="open('damage')"><template #icon><span class="roster-action-icon"><HeartCrack :size="20" /><span class="roster-action-count" aria-hidden="true">{{selection.damageTargets.length}}</span></span></template>Урон</ActionButton>
        <ActionButton v-if="selection.supportsExperience" variant="quiet" layout="stacked" :disabled="!selection.experienceTargets.length" :aria-label="`${encounter.isRed?'Добавить IP':'Добавить опыт'}: ${selection.experienceTargets.length}`" @click="open('experience')"><template #icon><span class="roster-action-icon"><Sparkles :size="20" /><span class="roster-action-count" aria-hidden="true">{{selection.experienceTargets.length}}</span></span></template>{{encounter.isRed?'IP':'Опыт'}}</ActionButton>
        <ActionButton variant="quiet" layout="stacked" :disabled="!selection.moveTargets.length" :aria-label="`${encounter.encounter.active?'Ввести в бой':'Добавить на сцену'}: ${selection.moveTargets.length}`" @click="encounter.sendCombatantsTo(selection.moveTargets,'combat')"><template #icon><span class="roster-action-icon"><Swords :size="20" /><span class="roster-action-count" aria-hidden="true">{{selection.moveTargets.length}}</span></span></template>{{encounter.encounter.active?'В бой':'На сцену'}}</ActionButton>
        <ActionButton variant="quiet" layout="stacked" :disabled="!encounter.selectedNpcCount"
                      :aria-label="`Удалить НПС: ${encounter.selectedNpcCount}`" @click="encounter.removeSelectedNpcs">
          <template #icon>
            <span class="roster-action-icon roster-remove-icon"><Trash2 :size="20" /><span class="roster-action-count" aria-hidden="true">{{ encounter.selectedNpcCount }}</span></span>
          </template>
          Удалить
        </ActionButton>
      </div></div>
    </div>
    <span v-if="groupedSummary" class="roster-count-sr-only" role="status">Выбрано: {{ selection.selected.length }}</span>
    <SessionSelectionSummary v-if="groupedSummary" :items="selection.selected" :encounter="encounter" />
    <div v-if="showSelectAll || selection.selected.length" class="roster-selection-heading">
      <label v-if="showSelectAll" class="roster-all-check"><CompactCheckbox :model-value="allVisible" :indeterminate="someVisible && !allVisible" :size="layoutTokens['roster-checkbox-icon']" :hit-size="layoutTokens['touch-min']" :disabled="!encounter.canManageReserves || !visibleRows.length" :label="visibleLabel" @update:model-value="selection.setVisibleSelection(visibleRows,$event)" /><span>Все</span></label>
      <span v-if="!groupedSummary" class="roster-selection-count" role="status">Выбрано: {{ selection.selected.length }}</span>
      <ActionButton class="roster-clear-selection" variant="quiet" :disabled="!selection.selected.length" aria-label="Сбросить выбор" @click="selection.clear"><slot name="clear-label">Сбросить выбор</slot></ActionButton>
      <slot />
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
import { HeartCrack, Sparkles, Swords, Trash2 } from '@lucide/vue'
import SessionSelectionSummary from './SessionSelectionSummary.vue'
import { layoutTokens } from '@/app/design-tokens'
import { charactersApi } from '@/shared/api/charactersApi'
import { pvExperiencePath } from '../lib/participantView'
import { experiencePlan, saveExperiencePlan } from '../lib/rosterExperience'
const props = defineProps({
  encounter: { type: Object, required: true },
  selection: { type: Object, required: true },
  visibleItems: { type: Array, default: () => [] },
  visibleLabel: { type: String, default: 'Выбрать всех в этой вкладке' },
  groupedSummary: Boolean,
  actionsVisible: { type: Boolean, default: true },
  showSelectAll: { type: Boolean, default: true },
  label: { type: String, default: 'Выбор участников' },
})
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
.roster-selection-count {margin-inline-start:auto;min-width:var(--spacing-large);padding-inline:var(--spacing-xs);border-radius:var(--radius-badge);background:var(--background);font-variant-numeric:tabular-nums}
.roster-clear-selection {margin-inline-start:auto}
.roster-selection-actions {display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);align-items:stretch;gap:var(--spacing-xs);padding-top:var(--spacing-xs)}
.roster-actions-reveal {display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows var(--motion-enter),opacity var(--motion-feedback)}
.roster-actions-reveal--open {grid-template-rows:1fr;opacity:1}
.roster-actions-clip {overflow:hidden;min-height:0}
.roster-action-icon {position:relative;display:inline-flex}
.roster-remove-icon {color:var(--danger)}
.roster-action-count {position:absolute;left:calc(100% - var(--spacing-xs));top:calc(var(--spacing-xs) * -1);min-width:var(--spacing-large);height:var(--spacing-large);box-sizing:border-box;padding-inline:var(--spacing-xs);border-radius:var(--radius-small);background:var(--surface-active);color:var(--text-1);font:600 var(--type-context-size)/var(--spacing-large) var(--font-ui)}
.roster-action-error {color:var(--danger)}
@media(prefers-reduced-motion:reduce){.roster-actions-reveal{transition:none}}
</style>
