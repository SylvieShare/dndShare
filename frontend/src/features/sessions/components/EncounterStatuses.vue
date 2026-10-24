<template>
  <SessionStatusIcons :items="items" :context="context" @remove="remove" @change-level="changeLevel" @edit-duration="durationUid = $event.id" />
  <StatusDurationModal v-if="durationStatus" :key="durationUid" :status="durationStatus" :z-index="9600" @close="durationUid = null" @save="saveDuration" />
</template>
<script setup>
import { computed, inject, ref } from 'vue'
import SessionStatusIcons from './SessionStatusIcons.vue'
import StatusDurationModal from '@/features/character-editor/blocks/dnd/components/StatusDurationModal.vue'
import { useItemReferenceMap } from '@/features/items/composables/useItemReferenceMap'
import { collectCharacterStatuses, removeStatusInstance, setStatusInstanceDuration, setStatusInstanceLevel } from '@/features/character-editor/lib/characterStatuses'
import { npcApplicationContext } from '../lib/npcApplicationContext'
import { statusDuration } from '@/shared/lib/statusDuration'
const props = defineProps({ combatant: { type: Object, required: true }, editable: Boolean })
const enc = inject('encounter', null) || inject('applicationEncounter', null)
const conditions = computed(() => enc.statesValue(props.combatant))
const values = computed(() => ({ states: props.combatant.effectInstances || [] }))
const { itemById, itemsById } = useItemReferenceMap(computed(() => [props.combatant.itemId, ...conditions.value, ...values.value.states.map(row => row.effect_id)].filter(Boolean)))
const context = computed(() => ({ ...npcApplicationContext(props.combatant, itemById(props.combatant.itemId), itemsById.value, props.editable), overlayZIndex: 9600 }))
const statuses = computed(() => collectCharacterStatuses(values.value, itemsById.value))
const items = computed(() => [
  ...conditions.value.map(id => ({ id: `condition:${id}`, kind: 'condition', value: itemById(id)?.name || 'Состояние', desc: itemById(id)?.data?.desc || itemById(id)?.data?.description || '', item: itemById(id) })),
  ...statuses.value.map(s => ({ id: s.uid, kind: 'states', value: s.title, desc: s.description, item: s.item, color: s.color,
    level: Number(s.params?.level ?? s.item?.data?.level) || 0, adjustableLevel: Number(s.item?.data?.level) > 0, maxLevel: Number(s.item?.data?.max_level) || 0,
    duration: statusDuration(s.duration) + (s.concentration ? ' · концентрация' : '') })),
])
const durationUid = ref(null)
const durationStatus = computed(() => statuses.value.find(s => s.uid === durationUid.value))
function remove(item) {
  if (!props.editable) return
  if (item.kind === 'condition') enc.setStates(props.combatant, conditions.value.filter(id => `condition:${id}` !== item.id))
  else props.combatant.effectInstances = removeStatusInstance(values.value, item.id)
}
function changeLevel(item, delta) {
  if (props.editable) props.combatant.effectInstances = setStatusInstanceLevel(values.value, item.id, Math.max(1, Math.min(item.maxLevel || 99, (item.level || 1) + delta)))
}
function saveDuration(duration) {
  if (!props.editable || !durationStatus.value) return
  props.combatant.effectInstances = setStatusInstanceDuration(values.value, durationUid.value, duration)
  durationUid.value = null
}
</script>
