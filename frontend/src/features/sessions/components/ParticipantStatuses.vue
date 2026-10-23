<template>
  <div class="participant-statuses" role="group" aria-label="Эффекты и состояния" @pointerdown.stop @click.stop @contextmenu.stop @keydown.stop>
    <DndStatusOverviewView
      :items="items" :editable="context.ownerMode" :context="context" icons-only :icon-size="48"
      @view="viewItem = $event.item"
      @remove="removeStatus"
      @increase-level="changeLevel($event, 1)"
      @decrease-level="changeLevel($event, -1)"
      @edit-duration="durationUid = $event.id"
      @show-tooltip="showTooltip"
      @hide-tooltip="tooltip = null"
    />
  </div>
  <ItemTooltip v-if="tooltip" :anchor="tooltip.anchor" :title="tooltip.value" :desc="tooltip.desc" :width="300" :z-index="9500">
    <template #details>
      <span>{{ tooltip.duration }}</span>
      <span v-if="tooltip.level">Уровень {{ tooltip.level }}</span>
    </template>
  </ItemTooltip>
  <ItemViewModal v-if="viewItem" :item="viewItem" :item-id="Number(viewItem.id)" :item-type-id="15" :z-index="9600" @close="viewItem = null" />
  <StatusDurationModal v-if="durationStatus" :key="durationStatus.uid" :status="durationStatus" :z-index="9600" @close="durationUid = null" @save="saveDuration" />
  <AppModalFrame v-if="error" title="Не удалось сохранить эффект" close-label="Закрыть" :z-index="9700" @close="error = ''">{{ error }}</AppModalFrame>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, shallowRef } from 'vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import DndStatusOverviewView from '@/features/character-editor/blocks/dnd/components/DndStatusOverviewView.vue'
import StatusDurationModal from '@/features/character-editor/blocks/dnd/components/StatusDurationModal.vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'
import { useParticipantStatusContext } from '../composables/useParticipantStatusContext'
import { statusDuration } from '@/shared/lib/statusDuration'

const ItemViewModal = defineAsyncComponent(() => import('@/features/handbook/components/ItemViewModal.vue'))
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
const tooltip = shallowRef(null), viewItem = shallowRef(null), durationUid = ref(null)
const durationStatus = computed(() => statuses.value.find(status => status.uid === durationUid.value))
function showTooltip(event, item) { tooltip.value = { ...item, anchor: event.currentTarget } }
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

<style scoped>
.participant-statuses { min-width: 0; height: 52px; }
</style>
