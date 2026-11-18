<template>
  <SessionNpcTile v-if="combatant.type === 'npc'" :combatant="combatant" :section="section" :editable="editable" :current="current" :selected="selected" @select="$emit('select')" />
  <SessionPlayerTile v-else-if="participant" :participant="participant" :name="enc.playerDisplayName(combatant)" :avatar-url="enc.getPlayerAva(combatant.charId)"
                     :color="enc.tileColor(combatant)" :hp="hp" :health-visible="hp.max > 0" :show-stats="editable && isDnd" :current="current"
                     :has-statuses="hasStatuses" :selectable="editable && combatant.position !== 'dead'" :selected="selected" @select="$emit('select')" :surprised="combatant.surprised && (!enc.encounter.active || enc.encounter.round === 0)" :edit-health="editable" @health="enc.openHpCalc(combatant)">
    <template #name-suffix><span v-if="combatant.initiative != null" class="encounter-initiative" :aria-label="`Инициатива: ${combatant.initiative}`"><img src="/static/initiative.svg" width="14" height="14" alt="" />{{combatant.initiative}}</span></template>
    <template v-if="combatant.position === 'dead' || (hp.current <= 0 && hp.max > 0)" #health><SessionPlayerDeathState :hp="hp" :editable="editable" :can-edit="editable && hp.current <= 0" :red="enc.isRed" @edit="enc.openHpCalc(combatant)" @revive="enc.requestRevive(combatant)" /></template>
    <template #presence><SessionCombatPresence :combatant="combatant" :active="enc.encounter.active" :current="enc.currentTurnUid === combatant.uid" /></template>
    <template #statuses><ParticipantStatuses :participant="participant" :editable="editable" detailed /></template>
  </SessionPlayerTile>
</template>
<script setup>
import { computed, defineAsyncComponent, inject } from 'vue'
import { useTemplateStore } from '@/stores/template'
import { settingAccessors } from '@/features/character-editor/settings'
import { hasDndStatusSummary } from '@/features/character-editor/lib/dndStatusSummary'
import SessionCombatPresence from './SessionCombatPresence.vue'
import SessionNpcTile from './SessionNpcTile.vue'
import SessionPlayerTile from './SessionPlayerTile.vue'
import SessionPlayerDeathState from './SessionPlayerDeathState.vue'
const ParticipantStatuses=defineAsyncComponent(()=>import('./ParticipantStatuses.vue'))
const props=defineProps({combatant:{type:Object,required:true},section:String,editable:Boolean,current:Boolean,selected:Boolean})
defineEmits(['select'])
const enc=inject('encounter'),templates=useTemplateStore()
const participant=computed(()=>props.combatant.type === 'player' ? enc.findParticipant(props.combatant.charId) : null)
const hp=computed(()=>enc.playerDsHp(props.combatant))
const isDnd=computed(()=>settingAccessors(templates.byId(participant.value?.templateId))?.system === 'dnd5e')
const hasStatuses=computed(()=>props.editable && isDnd.value && hasDndStatusSummary(participant.value?.data?.values || {}))
</script>
<style scoped>
.encounter-initiative {display:inline-flex;align-items:center;gap:var(--spacing-xs);flex:none;color:var(--text-muted);font-size:var(--type-context-size)}
</style>
