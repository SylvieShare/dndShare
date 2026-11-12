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
    <div class="stat-roll-summary">
      <SystemDie :sides="20" value="d20" :color="color" aria-hidden="true" />
      <div>
        <h3 class="stat-roll-heading"><span>{{ title }}</span><b>{{ signed(total) }}</b></h3>
        <dl v-if="details.length" class="stat-roll-details">
          <template v-for="row in details" :key="row.key">
            <dt>{{ row.label }}</dt><dd>{{ signed(row.value) }}</dd>
          </template>
        </dl>
      </div>
    </div>
    <template v-if="editable">
      <RowActionItem action="edit" @click="emit('edit')">Изменить</RowActionItem>
      <RowActionSeparator />
    </template>
    <div class="stat-roll-mode-label">Режим броска</div>
    <D20RollControls :scope="scope" :mode="mode" :cancelled="cancelled" @roll="(mode, excluded) => emit('roll', mode, excluded)" />
  </BasePopover>
</template>
<script setup>
import { BasePopover } from '@sylvieshare/share-ui'
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { formatBonus as signed } from '@/shared/lib/dnd'
import D20RollControls from './D20RollControls.vue'
defineProps({
  anchor: { type: Object, required: true },
  title: { type: String, required: true },
  color: { type: String, required: true },
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
.stat-roll-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--spacing-label);
  padding: var(--spacing-small) var(--spacing-label) var(--spacing-medium);
  border-bottom: 1px solid var(--border-strong);
}
.stat-roll-heading { margin: 0; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 14px; }
.stat-roll-heading span, .stat-roll-details dt { min-width: 0; overflow-wrap: anywhere; }
.stat-roll-heading b { flex-shrink: 0; }
.stat-roll-details {
  margin: var(--spacing-small) 0 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  color: var(--text-2);
  font-size: 12px;
}
.stat-roll-details dd { margin: 0; text-align: end; font-variant-numeric: tabular-nums; }
.stat-roll-mode-label {
  padding: var(--spacing-medium) var(--spacing-small) 0;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}
</style>
