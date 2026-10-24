<template>
  <SessionStatusIcons :items="items" :context="context" @remove="removeStatus" @change-level="changeLevel" @edit-duration="durationUid = $event.id" />
  <StatusDurationModal v-if="durationStatus" :key="durationStatus.uid" :status="durationStatus" :z-index="9600" @close="durationUid = null" @save="saveDuration" />
  <AppModalFrame v-if="error" title="Не удалось сохранить эффект" close-label="Закрыть" :z-index="9700" @close="error = ''">{{ error }}</AppModalFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import SessionStatusIcons from './SessionStatusIcons.vue'
import StatusDurationModal from '@/features/character-editor/blocks/dnd/components/StatusDurationModal.vue'
import { useParticipantStatusContext } from '../composables/useParticipantStatusContext'
import { statusDuration } from '@/shared/lib/statusDuration'

const props = defineProps({ participant: { type: Object, required: true }, editable: Boolean })
const { context, statuses, updateValues, error } = useParticipantStatusContext(() => props.participant, () => props.editable)
const items = computed(() => statuses.value.map(status => ({
  id: status.uid, kind: 'states', value: status.title, desc: status.description,
  item: status.item, color: status.color,
  level: Math.max(0, Number(status.params?.level ?? status.item?.data?.level) || 0),
  adjustableLevel: Number(status.item?.data?.level) > 0,
  maxLevel: Math.max(0, Number(status.item?.data?.max_level) || 0),
  duration: statusDuration(status.duration) + (status.concentration ? ' · концентрация' : ''),
})))
const durationUid = ref(null)
const durationStatus = computed(() => statuses.value.find(status => status.uid === durationUid.value))
function removeStatus(item) { return updateValues({ states: context.characterStatuses.remove(item.id) }) }
function changeLevel(item, delta) {
  const level = Math.max(1, Math.min(item.maxLevel || 99, (Number(item.level) || 1) + delta))
  return updateValues({ states: context.characterStatuses.setLevel(item.id, level) })
}
async function saveDuration(duration) {
  if (!durationStatus.value) return
  const saved = await updateValues({ states: context.characterStatuses.setDuration(durationUid.value, duration) })
  if (saved) durationUid.value = null
}
</script>
