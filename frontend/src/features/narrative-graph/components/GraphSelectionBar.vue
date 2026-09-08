<template>
  <nav class="graph-selection-bar" aria-label="Массовые действия" @pointerdown.stop>
    <strong>Выбрано: {{ count }}</strong>
    <button
      v-if="statusOptions.length"
      ref="statusTrigger"
      type="button"
      class="graph-selection-status"
      aria-haspopup="menu"
      :aria-expanded="statusOpen"
      @click="statusOpen = !statusOpen"
    >
      <ListChecks :size="15" />
      Статус
    </button>
    <button type="button" class="graph-selection-delete" @click="$emit('delete')">
      <Trash2 :size="15" />
      Удалить
    </button>
    <button type="button" class="graph-selection-clear" aria-label="Снять выделение" title="Снять выделение" @click="$emit('clear')">
      <X :size="16" />
    </button>

    <BasePopover
      v-model:open="statusOpen"
      :anchor="statusTrigger"
      :min-width="220"
      placement="bottom-start"
      transition-preset="action-menu"
      role="menu"
      aria-label="Изменить статус выбранных глав"
    >
      <RowActionItem
        v-for="status in statusOptions"
        :key="status.key"
        :icon="Circle"
        :style="{ color: status.color }"
        @click="chooseStatus(status.key)"
      >{{ status.label }}</RowActionItem>
    </BasePopover>
  </nav>
</template>

<script setup>
import { ref } from 'vue'
import { Circle, ListChecks, Trash2, X } from '@lucide/vue'
import { BasePopover } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'

defineProps({
  count: { type: Number, required: true },
  statusOptions: { type: Array, default: () => [] },
})
const emit = defineEmits(['status', 'delete', 'clear'])
const statusTrigger = ref(null)
const statusOpen = ref(false)

function chooseStatus(status) {
  statusOpen.value = false
  emit('status', status)
}
</script>

<style scoped>
.graph-selection-bar {
  position: absolute;
  z-index: 35;
  bottom: 18px;
  left: calc(var(--chapter-safe-left, 0px) + (100% - var(--chapter-safe-left, 0px) - var(--chapter-safe-right, 0px)) / 2);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px 7px 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border-strong));
  border-radius: 10px;
  background: color-mix(in srgb, var(--popover-bg) 94%, transparent);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(14px) saturate(1.12);
  transform: translateX(-50%);
}
.graph-selection-bar strong {
  color: var(--text-1);
  font-size: 12px;
  font-weight: 750;
  white-space: nowrap;
}
.graph-selection-bar button {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  font: inherit;
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;
}
.graph-selection-delete {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}
.graph-selection-status {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
}
.graph-selection-status:hover,
.graph-selection-status:focus-visible {
  border-color: color-mix(in srgb, var(--accent) 42%, transparent);
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  outline: none;
}
.graph-selection-delete:hover,
.graph-selection-delete:focus-visible {
  border-color: color-mix(in srgb, var(--danger) 42%, transparent);
  background: color-mix(in srgb, var(--danger) 22%, transparent);
  outline: none;
}
.graph-selection-bar .graph-selection-clear {
  width: 30px;
  padding: 0;
  background: transparent;
  color: var(--text-muted);
}
.graph-selection-clear:hover,
.graph-selection-clear:focus-visible {
  background: var(--surface-active);
  color: var(--text-1);
  outline: none;
}
</style>
