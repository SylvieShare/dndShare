<template>
  <RowActionItem v-if="ctx.ownerMode && ctx.topSession && ctx.itemTransfers && !entry?.params?.magic?.lost"
    :icon="Send" @click="transfer">Передать другому игроку</RowActionItem>
</template>
<script setup>
import { inject } from 'vue'
import { Send } from '@lucide/vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
const props = defineProps({ source: { type: String, required: true }, entry: { type: Object, required: true }, name: { type: String, default: 'Предмет' } })
const emit = defineEmits(['close'])
const ctx = inject('charCtx', {})
function transfer() {
  emit('close')
  ctx.itemTransfers.select(props.source, props.entry, props.name)
}
</script>
