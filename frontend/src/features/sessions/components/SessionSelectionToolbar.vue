<template>
  <div class="roster-selection" :aria-label="label">
    <div class="roster-selection-heading">
      <ActionButton :variant="selection.selecting ? 'secondary' : 'quiet'" :disabled="!selection.selecting && (!encounter.canManageReserves || !selection.items.length)" :aria-pressed="selection.selecting" @click="selection.toggle">
        <template #icon><Check v-if="selection.selecting" :size="18" /><ListChecks v-else :size="18" /></template>
        Режим выбора <span class="roster-selection-count" role="status" title="Всего выбрано">{{ selection.selected.length }}</span>
      </ActionButton>
      <slot />
    </div>
    <div v-if="actionsVisible" class="roster-actions-reveal roster-actions-reveal--open">
      <div class="roster-actions-clip"><div class="roster-selection-actions" role="group" aria-label="Действия с выбранными">
        <ActionButton variant="quiet" layout="stacked" :disabled="!selection.damageTargets.length" aria-label="Нанести урон" @click="open('damage')"><template #icon><HeartCrack :size="20" /></template>Урон</ActionButton>
        <ActionButton v-if="selection.supportsExperience" variant="quiet" layout="stacked" :disabled="!selection.experienceTargets.length" :aria-label="encounter.isRed?'Добавить IP':'Добавить опыт'" @click="open('experience')"><template #icon><Sparkles :size="20" /></template>{{encounter.isRed?'IP':'Опыт'}}</ActionButton>
        <ActionButton v-if="combatWorkspace && selection.moveTargets.length" variant="quiet" layout="stacked" aria-label="Переместить в бой" @click="encounter.sendCombatantsTo(selection.moveTargets,'combat')"><template #icon><Swords :size="20" /></template>В бой</ActionButton>
      </div></div>
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
import { ref, shallowRef } from 'vue'
import { ActionButton, AppModalFrame, FormActionButtons, FormField, FormNumberInput } from '@sylvieshare/share-ui'
import { Check, HeartCrack, ListChecks, Sparkles, Swords } from '@lucide/vue'
import { charactersApi } from '@/shared/api/charactersApi'
import { pvExperiencePath } from '../lib/participantView'
import { experiencePlan, saveExperiencePlan } from '../lib/rosterExperience'
const props=defineProps({encounter:{type:Object,required:true},selection:{type:Object,required:true},combatWorkspace:Boolean,actionsVisible:{type:Boolean,default:true},label:{type:String,default:'Выбор участников'}})
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
.roster-action-summary {font-size:var(--type-caption-size);color:var(--text-muted)}
.roster-selection-count {min-width:var(--spacing-large);padding-inline:var(--spacing-xs);border-radius:var(--radius-badge);background:var(--background);font-variant-numeric:tabular-nums}
.roster-selection-actions {display:flex;align-items:center;gap:var(--spacing-xs);padding-top:var(--spacing-xs)}
.roster-actions-reveal {display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows var(--motion-enter),opacity var(--motion-feedback)}
.roster-actions-reveal--open {grid-template-rows:1fr;opacity:1}
.roster-actions-clip {overflow:hidden;min-height:0}
.roster-action-error {color:var(--danger)}
@media(prefers-reduced-motion:reduce){.roster-actions-reveal{transition:none}}
</style>
