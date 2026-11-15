<template>
  <SessionStatusIcons :items="items" :context="context" :detailed="detailed" @remove="removeStatus" @change-level="changeLevel" @edit-duration="durationUid = $event.id" />
  <StatusDurationModal v-if="durationStatus" :key="durationStatus.uid" :status="durationStatus" :z-index="9600" @close="durationUid = null" @save="saveDuration" />
  <AppModalFrame v-if="error" title="Не удалось сохранить эффект" close-label="Закрыть" :z-index="9700" @close="error = ''">{{ error }}</AppModalFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import SessionStatusIcons from './SessionStatusIcons.vue'
import StatusDurationModal from '@/features/character-editor/blocks/dnd/components/StatusDurationModal.vue'
import { useParticipantStatusContext } from '../composables/useParticipantStatusContext'
import { dndStatusSummary } from '@/features/character-editor/lib/dndStatusSummary'
import { normalizeExhaustion } from '@/features/character-editor/blocks/dnd/lib/exhaustion'

const props = defineProps({ participant: { type: Object, required: true }, editable: Boolean, detailed: Boolean })
const { context, statuses, updateValues, error } = useParticipantStatusContext(() => props.participant, () => props.editable)
const items = computed(() => dndStatusSummary({
  statuses: statuses.value, values: props.participant.data?.values || {}, rulesVersion: context.rulesVersion,
  itemByCode: code => context.characterStatuses.itemByCode(code),
}))
const durationUid = ref(null)
const durationStatus = computed(() => statuses.value.find(status => status.uid === durationUid.value))
function saveExhaustion(level) {
  const { data } = normalizeExhaustion(props.participant.data?.values?.exhaustion, context.rulesVersion)
  return updateValues({ exhaustion: { ...data, level } })
}
function removeStatus(item) {
  if (item.kind === 'inspiration') return updateValues({ inspiration: false })
  if (item.kind === 'exhaustion') return saveExhaustion(0)
  return updateValues({ states: context.characterStatuses.remove(item.id) })
}
function changeLevel(item, delta) {
  const level = Math.max(1, Math.min(item.maxLevel || 99, (Number(item.level) || 1) + delta))
  if (item.kind === 'exhaustion') return saveExhaustion(level)
  return updateValues({ states: context.characterStatuses.setLevel(item.id, level) })
}
async function saveDuration(duration) {
  if (!durationStatus.value) return
  const saved = await updateValues({ states: context.characterStatuses.setDuration(durationUid.value, duration) })
  if (saved) durationUid.value = null
}
</script>
