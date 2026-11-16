<template>
  <SessionRosterTile class="session-npc-tile" :name="enc.npcName(combatant)" :color="enc.tileColor(combatant)" :armor="Number(enc.displayAc(combatant)) || 0"
    :hp="enc.npcDsHp(combatant)" health-visible :edit-health="editable" :has-statuses="hasStatuses"
    :data-relation="SIDE_COLOR[combatant.side] ? combatant.side : undefined" :aria-description="SIDE_LABEL[combatant.side] ? `Отношение: ${SIDE_LABEL[combatant.side]}` : undefined"
    :selectable="editable" :selected="selected" :current="current || (enc.encounter.active && combatant.position === 'combat' && enc.currentTurnUid === combatant.uid)" :surprised="combatant.surprised && (!enc.encounter.active || enc.encounter.round === 0)" @select="$emit('select')" @health="combatant.position === 'combat' ? enc.openHpCalc(combatant) : enc.openNpcHpEdit(combatant)">
    <template #portrait><EncounterAvatar :combatant="combatant" /></template>
    <template #portrait-overlay><EncounterMarkerMenu :combatant="combatant" :editable="editable" overlay /></template>
    <template #name-suffix><span v-if="combatant.initiative != null" class="reserve-initiative" :aria-label="`Инициатива: ${combatant.initiative}`"><img src="/static/initiative.svg" width="14" height="14" alt="" />{{ combatant.initiative }}</span></template>
    <template #presence><SessionCombatPresence :combatant="combatant" :active="enc.encounter.active" :current="enc.currentTurnUid === combatant.uid" /></template>
    <template #statuses><EncounterStatuses :combatant="combatant" :editable="editable" detailed /></template>
  </SessionRosterTile>
</template>
<script setup>
import { computed, inject } from 'vue'
import SessionCombatPresence from './SessionCombatPresence.vue'
import SessionRosterTile from './SessionRosterTile.vue'
import EncounterAvatar from './EncounterAvatar.vue'
import EncounterMarkerMenu from './EncounterMarkerMenu.vue'
import EncounterStatuses from './EncounterStatuses.vue'
import { SIDE_COLOR, SIDE_LABEL } from '../lib/encounterHelpers'
const props=defineProps({combatant:{type:Object,required:true},editable:Boolean,selected:Boolean,current:Boolean,section:{type:String,default:'reserve-npc'}})
defineEmits(['select'])
const enc=inject('encounter')
const hasStatuses=computed(()=>!!(props.combatant.effectInstances?.length || enc.statesValue(props.combatant)?.length))
</script>
<style scoped>
.session-npc-tile {--creature-avatar-size:var(--summary-avatar-size,var(--layout-sheet-header-icon))}
.reserve-initiative {display:inline-flex;align-items:center;gap:var(--spacing-xs);flex:none;color:var(--text-muted);font-size:var(--type-context-size)}
</style>
