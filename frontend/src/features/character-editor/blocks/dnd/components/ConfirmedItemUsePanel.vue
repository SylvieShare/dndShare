<template>
  <ItemUsePanel v-for="use in uses" :key="use.key" :title="use.title">
    <ItemResourcePips v-if="use.show_resource && use.resource" :resource="use.resource" :interactive="!!charCtx.ownerMode" @toggle="toggle(use, $event)" />
    <DndRichContent v-if="use.description" :html="use.description" />
    <MechanicTheses :lines="use.requirements" />
    <template v-if="charCtx.ownerMode" #actions>
      <ActionButton v-if="reroll(use)" :disabled="busy || !!use.error" @click="dice.runAction(reroll(use).id, reroll(use).key)">Перебросить: {{ reroll(use).title }}</ActionButton>
      <ActionButton :disabled="busy || !!use.error" :title="use.error || undefined" @click="confirm(use)">{{ use.confirm_label }} · −{{ use.resource_cost }} заряд</ActionButton>
      <small v-if="use.error">{{ use.error }}</small>
    </template>
  </ItemUsePanel>
</template>
<script setup>
import { computed, inject, nextTick, ref, unref } from 'vue'
import ItemResourcePips from './ItemResourcePips.vue'
import { useDiceStore } from '@/stores/dice'
import { ActionButton } from '@sylvieshare/share-ui'
import ItemUsePanel from './ItemUsePanel.vue'
import DndRichContent from '@/shared/ui/DndRichContent.vue'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import { confirmedItemUses, confirmItemUse } from '@/features/character-editor/lib/confirmedItemUses'
const props = defineProps({ uid: String })
const charCtx = inject('charCtx', {}), busy = ref(false), dice = useDiceStore()
const values = () => unref(charCtx.values) || {}
const items = () => unref(charCtx.characterResources?.itemsById) || new Map()
const uses = computed(() => confirmedItemUses(values(), items(), props.uid))
function reroll(use) {
  const row = dice.lastD20
  const action = row?.actions?.find(action => action.useRef?.uid === props.uid && action.useRef?.key === use.key)
  return action ? { id: row.id, key: action.key, title: row.title } : null
}
function toggle(use, pip) {
  if (!charCtx.ownerMode || !use.resource) return
  const patch = charCtx.characterResources?.setAvailable?.(use.resource.key, pip <= use.resource.value ? pip - 1 : pip)
  if (patch) charCtx.updateValues(patch)
}
async function confirm(use) {
  if (busy.value) return
  busy.value = true
  try {
    const patch = confirmItemUse(values(), items(), props.uid, use.key, !!charCtx.ownerMode)
    if (!Object.keys(patch).length) return
    charCtx.updateValues(patch)
    charCtx.logSessionEvent?.({ type: 'feature_state', action: `${use.item.name}: ${use.confirm_label}`, data: { instanceUid: props.uid, resourceSpent: use.resource_cost } })
    await nextTick()
  } finally { busy.value = false }
}
</script>
