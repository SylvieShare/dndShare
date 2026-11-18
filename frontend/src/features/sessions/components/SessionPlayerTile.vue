<template>
  <SessionRosterTile class="session-player-tile" :name="name" :avatar-url="avatarUrl" :color="color" :hp="hp" :stage-backdrop="stageBackdrop" :stage-description="stageDescription" :health-visible="healthVisible"
    :armor="showStats && !loading && !error ? stats.armorClass : undefined" :show-passives="showStats && !loading && !error"
    :perception="stats.passives[0]?.value" :investigation="stats.passives[1]?.value" :current="current" :compact="compact"
    :has-statuses="hasStatuses" :selectable="selectable" :selected="selected" :edit-health="editHealth" :surprised="surprised" @health="$emit('health')" @select="$emit('select')">
    <template #name-suffix><slot name="name-suffix" /></template>
    <template v-if="$slots.health" #health><slot name="health" /></template>
    <template #metrics><SkeletonBlock v-if="showStats && loading" width="110px" height="28px" /><span v-else-if="showStats && error" class="player-metric-error" role="alert">{{ error }}</span></template>
    <template #presence><slot name="presence" /></template>
    <template #statuses><slot name="statuses" /></template>
  </SessionRosterTile>
</template>
<script setup>
import { SkeletonBlock } from '@sylvieshare/share-ui'
import SessionRosterTile from './SessionRosterTile.vue'
import { useParticipantDefenses } from '../composables/useParticipantDefenses'
const props=defineProps({participant:Object,name:String,avatarUrl:String,color:String,hp:Object,healthVisible:Boolean,showStats:Boolean,
  compact:Boolean,current:Boolean,hasStatuses:Boolean,selectable:Boolean,selected:Boolean,editHealth:Boolean,surprised:Boolean,stageBackdrop:Boolean,stageDescription:String})
defineEmits(['health','select'])
const { stats,loading,error }=useParticipantDefenses(()=>props.participant,()=>props.showStats)
</script>
<style scoped>
.player-metric-error {font-size:var(--type-context-size);color:var(--danger)}
</style>
