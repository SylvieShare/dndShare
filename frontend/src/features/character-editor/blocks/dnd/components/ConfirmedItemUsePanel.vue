<template>
  <ItemUsePanel v-for="use in uses" :key="use.key" :title="use.title">
    <DndRichContent v-if="use.description" :html="use.description" />
    <MechanicTheses :lines="use.requirements" />
    <template v-if="charCtx.ownerMode" #actions>
      <ActionButton :disabled="busy || !!use.error" :title="use.error || undefined" @click="confirm(use)">{{ use.confirm_label }} · −{{ use.resource_cost }} заряд</ActionButton>
      <small v-if="use.error">{{ use.error }}</small>
    </template>
  </ItemUsePanel>
</template>
<script setup>
import { computed, inject, nextTick, ref, unref } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import ItemUsePanel from './ItemUsePanel.vue'
import DndRichContent from '@/shared/ui/DndRichContent.vue'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import { confirmedItemUses, confirmItemUse } from '@/features/character-editor/lib/confirmedItemUses'
const props = defineProps({ uid: String })
const charCtx = inject('charCtx', {}), busy = ref(false)
const values = () => unref(charCtx.values) || {}
const items = () => unref(charCtx.characterResources?.itemsById) || new Map()
const uses = computed(() => confirmedItemUses(values(), items(), props.uid))
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
