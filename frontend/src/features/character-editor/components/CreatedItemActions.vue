<template>
  <RowActionItem v-if="ctx.ownerMode && entry.params?.creation" :icon="Clock" @click="toggle">{{ entry.params.creation.expired ? 'Вернуть срок действия' : 'Отметить окончание срока' }}</RowActionItem>
</template>
<script setup>
import { inject } from 'vue'
import { Clock } from '@lucide/vue'
import { mapOwnedEntries } from '@/features/character-editor/lib/characterMagicItems'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
const props = defineProps({ entry: { type: Object, required: true } })
const emit = defineEmits(['close'])
const ctx = inject('charCtx', {})
function toggle() {
  const transform = entry => entry.uid !== props.entry.uid ? entry : ({ ...entry, params: { ...entry.params, creation: { ...entry.params.creation, expired: !props.entry.params.creation.expired } } })
  ctx.updateValues({ ...mapOwnedEntries(ctx.values, transform), ...(Array.isArray(ctx.values.potions) ? { potions: ctx.values.potions.map(transform) } : {}) })
  emit('close')
}
</script>
