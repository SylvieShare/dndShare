<template>
  <SessionRosterTile class="session-reserve-tile" :name="enc.npcName(combatant)" :color="enc.tileColor(combatant)" :armor="Number(enc.displayAc(combatant)) || 0"
    :hp="enc.npcDsHp(combatant)" health-visible :edit-health="editable && !selectionMode" :has-statuses="hasStatuses"
    :data-relation="SIDE_COLOR[combatant.side] ? combatant.side : undefined" :aria-description="SIDE_LABEL[combatant.side] ? `Отношение: ${SIDE_LABEL[combatant.side]}` : undefined"
    :selection-mode="selectionMode" :selected="selected" @health="enc.openNpcHpEdit(combatant)">
    <template #portrait><EncounterAvatar :combatant="combatant" /></template>
    <template #name-prefix><EncounterMarkerMenu :combatant="combatant" :editable="editable" /></template>
    <template #name-suffix><span v-if="combatant.initiative != null" class="reserve-initiative" :aria-label="`Инициатива: ${combatant.initiative}`"><img src="/static/initiative.svg" width="14" height="14" alt="" />{{ combatant.initiative }}</span><span v-if="SIDE_LABEL[combatant.side]" class="reserve-relation" :style="{color:SIDE_COLOR[combatant.side]}">{{ SIDE_LABEL[combatant.side] }}</span></template>
    <template #statuses><EncounterStatuses :combatant="combatant" :editable="editable" detailed /></template>
  </SessionRosterTile>
</template>
<script setup>
import { computed, inject } from 'vue'
import SessionRosterTile from './SessionRosterTile.vue'
import EncounterAvatar from './EncounterAvatar.vue'
import EncounterMarkerMenu from './EncounterMarkerMenu.vue'
import EncounterStatuses from './EncounterStatuses.vue'
import { SIDE_COLOR, SIDE_LABEL } from '../lib/encounterHelpers'
const props=defineProps({combatant:{type:Object,required:true},editable:Boolean,selectionMode:Boolean,selected:Boolean})
const enc=inject('encounter')
const hasStatuses=computed(()=>!!(props.combatant.effectInstances?.length || enc.statesValue(props.combatant)?.length))
</script>
<style scoped>
.session-reserve-tile {--creature-avatar-size:var(--layout-sheet-header-icon)}
.reserve-initiative {display:inline-flex;align-items:center;gap:var(--spacing-xs);flex:none;color:var(--text-muted);font-size:var(--type-context-size)}
.reserve-relation {font-size:var(--type-context-size);flex:none}
</style>
