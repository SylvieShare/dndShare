<template>
  <BasePopover
    :open="true"
    :anchor="anchor"
    :z-index="4100"
    transition-preset="action-menu"
    role="menu"
    :aria-label="title"
    @update:open="!$event && emit('close')"
  >
    <div class="stat-roll-heading"><strong>{{ title }}</strong><b>{{ signed(total) }}</b></div>
    <div v-if="details.length" class="stat-roll-details"><div v-for="row in details" :key="row.key"><span>{{ row.label }}</span><b>{{ signed(row.value) }}</b></div></div>
    <D20RollControls :scope="scope" :mode="mode" :cancelled="cancelled" @roll="(mode, excluded) => emit('roll', mode, excluded)" />
    <RowActionItem v-if="editable" action="edit" @click="emit('edit')">Изменить</RowActionItem>
  </BasePopover>
</template>
<script setup>
import { BasePopover } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { signedOrZero as signed } from '@/shared/lib/dnd'
import D20RollControls from './D20RollControls.vue'
defineProps({
  anchor: { type: Object, required: true },
  title: { type: String, required: true },
  mode: { type: String, default: 'normal' },
  scope: String,
  cancelled: Boolean,
  total: Number,
  editable: Boolean,
  details: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'roll', 'edit'])
</script>

<style scoped>
.stat-roll-heading, .stat-roll-details > div { display: flex; justify-content: space-between; gap: 12px; }
.stat-roll-heading { padding: 10px; font-size: 14px; }
.stat-roll-details { padding: 0 10px 10px; color: var(--text-2); font-size: 12px; display: grid; gap: 5px; max-width: 328px; }
</style>
