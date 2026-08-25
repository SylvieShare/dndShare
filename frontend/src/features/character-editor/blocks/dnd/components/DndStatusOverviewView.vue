<template>
  <div v-if="items.length || editable" class="dsov">
    <div v-if="items.length" class="dsov-row">
      <RowActionMenu
        v-for="item in items"
        :key="item.id"
        :title="`Действия: ${item.value}`"
      >
        <template #trigger="{ open }">
          <button
            class="dsov-effect action-menu-source"
            :class="{ 'action-menu-source--open': open }"
            type="button"
            :style="{ '--status-color': item.color || 'var(--text-muted)' }"
            @click="$emit('hide-tooltip')"
            @mouseenter="$emit('show-tooltip', $event, item)"
            @mouseleave="$emit('hide-tooltip')"
          >
            <span class="dsov-icon">
              <ItemIcon
                v-if="item.item && (item.item.iconImageUrl || item.item.svg)"
                class="dsov-item-icon"
                :item="item.item"
                :fallback-to-type="false"
                :size="64"
              />
              <BatteryLow v-else-if="item.kind === 'exhaustion'" :size="38" :stroke-width="1.7" aria-hidden="true" />
              <Sparkles v-else-if="item.kind === 'inspiration'" :size="40" :stroke-width="1.7" aria-hidden="true" />
              <span v-else class="dsov-monogram" aria-hidden="true">{{ monogram(item.value) }}</span>
            </span>

            <span class="dsov-copy">
              <span class="dsov-heading">
                <span class="dsov-name" :title="item.value">{{ item.value }}</span>
                <span v-if="item.level" class="dsov-level">Уровень {{ item.level }}</span>
              </span>
              <span v-if="item.thesis" class="dsov-thesis">{{ item.thesis }}</span>
            </span>
          </button>
        </template>

        <template #default="{ close }">
          <RowActionItem v-if="item.item" action="view" tone="info" @click="select(item, close, 'view')">
            Посмотреть
          </RowActionItem>
          <RowActionItem
            v-if="editable && item.adjustableLevel && (!item.maxLevel || item.level < item.maxLevel)"
            :icon="Plus"
            @click="select(item, close, 'increase-level')"
          >
            Повысить уровень
          </RowActionItem>
          <RowActionItem
            v-if="editable && item.adjustableLevel && item.level > 1"
            :icon="Minus"
            @click="select(item, close, 'decrease-level')"
          >
            Понизить уровень
          </RowActionItem>
          <RowActionSeparator v-if="editable" />
          <RowActionItem v-if="editable" action="remove" tone="danger" @click="select(item, close, 'remove')">
            Убрать
          </RowActionItem>
        </template>
      </RowActionMenu>
    </div>

    <button v-if="showAddAction" class="dsov-add" type="button" @click.stop="$emit('add')">
      <Plus :size="15" :stroke-width="1.8" aria-hidden="true" />
      <span>Состояние</span>
    </button>
  </div>
</template>

<script setup>
import { BatteryLow, Minus, Plus, Sparkles } from '@lucide/vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'

defineProps({
  items: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  showAddAction: { type: Boolean, default: false },
})
const emit = defineEmits(['add', 'view', 'remove', 'increase-level', 'decrease-level', 'show-tooltip', 'hide-tooltip'])

function select(item, close, action) {
  close()
  emit(action, item)
}

function monogram(value) {
  return String(value || '?').trim().slice(0, 1).toUpperCase() || '?'
}
</script>

<style scoped>
.dsov { display: flex; min-width: 0; align-items: center; gap: 13px; padding: 0 0 15px 15px; }
.dsov-row {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  align-items: center;
  gap: 13px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.dsov-effect {
  display: grid;
  width: 300px;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 0;
  flex: 0 0 300px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-1);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.14s;
}
.dsov-icon {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  overflow: hidden;
}
.dsov-item-icon { width: 64px; height: 64px; }
.dsov-item-icon :deep(img),
.dsov-item-icon :deep(svg) { width: 100%; height: 100%; object-fit: cover; }
.dsov-monogram { font-size: 24px; font-weight: 800; }
.dsov-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}
.dsov-heading { display: flex; min-width: 0; align-items: center; gap: 5px; }
.dsov-name { min-width: 0; overflow: hidden; font-size: 11px; font-weight: 750; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
.dsov-level { flex: 0 0 auto; color: var(--status-color); font-size: 8px; font-weight: 700; line-height: 1; }
.dsov-thesis {
  color: var(--text-muted);
  font-size: 9px;
  line-height: 1.35;
  white-space: pre-line;
}
.dsov-add {
  display: inline-flex;
  width: 92px;
  height: 64px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex: 0 0 auto;
  padding: 0 9px;
  border: 1px dashed color-mix(in srgb, var(--text-muted) 58%, transparent);
  border-radius: 9px;
  background: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 10px;
  font-weight: 650;
  cursor: pointer;
}

@media (hover: hover) {
  .dsov-effect:hover { transform: translateY(-1px); }
  .dsov-add:hover { border-color: var(--text-muted); color: var(--text-2); }
}
</style>
