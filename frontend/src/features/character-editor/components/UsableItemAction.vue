<template>
  <ItemTransferAction v-if="item?.data?.usable && !entry.params?.creation?.expired" purpose="use" :source="source" :entry="entry" :name="name || item.name" @self="useSelf" @close="emit('close')" />
</template>
<script setup>
import { inject } from 'vue'
import ItemTransferAction from './ItemTransferAction.vue'
const props = defineProps({ item: Object, entry: { type: Object, required: true }, source: { type: String, required: true }, name: String })
const emit = defineEmits(['close'])
const ctx = inject('charCtx', {})
async function useSelf() {
  if (await ctx.itemTransfers?.usable?.self({ ...props.entry, name: props.name || props.item.name }, props.source)) emit('close')
}
</script>
