<template>
  <ItemMechanicPanel kind="confirmed_use" v-for="use in uses" :key="use.key" :title="use.title">
    <template v-if="linked(use)" #summary><ItemResourcePips :resource="linked(use)" :interactive="!!charCtx.ownerMode" hide-recovery @toggle="toggle(use, $event)" /></template>
    <DndRichContent v-if="use.description" :html="use.description" :item="use.item" />
    <MechanicTheses :lines="use.requirements" />
    <template v-if="charCtx.ownerMode" #actions>
      <ActionButton v-if="reroll(use)" :disabled="busy || !!use.error" @click="dice.runAction(reroll(use).id, reroll(use).key)">Перебросить: {{ reroll(use).title }}</ActionButton>
      <ActionButton :disabled="busy || !!use.error" :title="use.error || undefined" @click="confirm(use)">{{ use.confirm_label }} · −{{ use.resource_cost }} заряд</ActionButton>
      <small v-if="use.error">{{ use.error }}</small>
    </template>
  </ItemMechanicPanel>
</template>
<script setup>
import { itemEventData, resourceChangeData, logResourceChange } from '@/features/character-editor/lib/sessionEventData'

import { computed, inject, nextTick, ref, unref } from 'vue'
import ItemResourcePips from './ItemResourcePips.vue'
import { useDiceStore } from '@/stores/dice'
import { ActionButton } from '@sylvieshare/share-ui'
import ItemMechanicPanel from '@/features/items/components/ItemMechanicPanel.vue'
import DndRichContent from '@/shared/ui/DndRichContent.vue'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import { confirmedItemUses, confirmItemUse } from '@/features/character-editor/lib/confirmedItemUses'
const props = defineProps({ uid: String, resources: { type: Object, default: null } })
const charCtx = inject('charCtx', {}), busy = ref(false), dice = useDiceStore()
const values = () => unref(charCtx.values) || {}
const items = () => unref(charCtx.characterResources?.itemsById) || new Map()
const uses = computed(() => confirmedItemUses(values(), items(), props.uid))
function linked(use) { return props.resources ? props.resources[use.key]?.[0] : use.show_resource && use.resource }
function reroll(use) {
  const row = dice.lastD20
  const action = row?.actions?.find(action => action.useRef?.uid === props.uid && action.useRef?.key === use.key)
  return action ? { id: row.id, key: action.key, title: row.title } : null
}
function toggle(use, pip) {
  if (!charCtx.ownerMode || !use.resource) return
  const next = pip <= use.resource.value ? pip - 1 : pip
  const patch = charCtx.characterResources?.setAvailable?.(use.resource.key, next)
  if (patch && Object.keys(patch).length) logResourceChange(charCtx, use.resource, next, use.item)
  if (patch) charCtx.updateValues(patch)
}
async function confirm(use) {
  if (busy.value) return
  busy.value = true
  try {
    const patch = confirmItemUse(values(), items(), props.uid, use.key, !!charCtx.ownerMode)
    if (!Object.keys(patch).length) return
    charCtx.updateValues(patch)
    charCtx.logSessionEvent?.({ type: 'feature_state', action: `${use.item.name}: ${use.confirm_label}`, data: { ...(use.resource ? resourceChangeData(use.resource, use.resource.value - use.resource_cost) : {}), ...itemEventData(use.item), instanceUid: props.uid, resourceSpent: use.resource_cost } })
    await nextTick()
  } finally { busy.value = false }
}
</script>
