<template>
  <RowActionItem v-if="ctx.ownerMode && creation && creation.duration?.kind !== 'permanent'" :icon="Clock" @click="creation.on_expire === 'vanish' ? confirming = true : toggle()">{{ creation.expired ? 'Вернуть срок действия' : 'Отметить окончание срока' }}</RowActionItem>
  <ConfirmDialog v-if="confirming" title="Срок действия закончился?" :message="`Остаток этой стопки (${entry.count ?? 1} шт.) исчезнет из инвентаря. Отмечайте это по игровому времени.`" confirm-text="Предметы исчезли" :z-index="4600" @confirm="toggle" @cancel="confirming = false" @close="confirming = false" />
</template>
<script setup>
import { computed, inject, ref } from 'vue'
import { Clock } from '@lucide/vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import { expireCreatedItem } from '@/features/character-editor/lib/createdItemExpiry'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
const props = defineProps({ entry: { type: Object, required: true } })
const emit = defineEmits(['close'])
const ctx = inject('charCtx', {})
const creation = computed(() => props.entry.params?.creation)
const confirming = ref(false)
function toggle() {
  if (!ctx.ownerMode) return
  ctx.updateValues(expireCreatedItem(ctx.values, props.entry.uid))
  confirming.value = false
  emit('close')
}
</script>
