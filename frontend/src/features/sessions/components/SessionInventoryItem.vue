<template>
  <RowActionMenu related block :disabled="busy || sortable.suppressNextClick" :title="row.name">
    <template #trigger="{ open }">
      <InventoryBagItem :item-key="row.id" :item="item" :name="row.name" :count="row.entry?.count" v-bind="traits" :source="sortable.isSource(row)" :draggable="!busy" :disabled="busy || sortable.suppressNextClick"
        :class="{ 'action-menu-source--open': open }" @pointerdown="hideTooltip(); !busy && sortable.startDrag($event, row, 'session-inventory', index)"
        @mouseenter="!sortable.dragging && showTooltip($event, display)" @mouseleave="hideTooltip" @focus="showTooltip($event, display)" @blur="hideTooltip" @click="hideTooltip" />
    </template>
    <template #default="{ close }">
      <InventoryItemMenuHeader :name="row.name" />
      <RowActionItem action="view" @click="$emit('view', row); close()">Открыть описание</RowActionItem>
      <RowActionSubmenu label="Кому передать" :min-width="260" :mobile-breakpoint="0" :disabled="busy">
        <template #trigger="{ open: sending }"><RowActionItem :icon="Send" submenu :submenu-open="sending">Передать</RowActionItem></template>
        <template #default="{ close: closeRecipients }">
          <p v-if="!players.length" class="inventory-no-players">В сессии пока нет игроков</p>
          <RowActionItem v-for="player in players" :key="player.charUuid" :disabled="busy" class="inventory-player" @click="send(player, closeRecipients, close)">
            <template #icon><img v-if="pvAvatar(player)" :src="pvAvatar(player)" alt="" /><UserRound v-else :size="36" /></template>
            {{ pvName(player) || 'Без имени' }}
          </RowActionItem>
        </template>
      </RowActionSubmenu>
      <RowActionItem action="delete" tone="danger" :disabled="busy" @click="$emit('remove', row); close()">Удалить</RowActionItem>
    </template>
  </RowActionMenu>
  <InventoryItemTooltip :tooltip="tooltip" />
</template>
<script setup>
import { computed, watch } from 'vue'
import { Send, UserRound } from '@lucide/vue'
import { RowActionMenu, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import InventoryItemMenuHeader from '@/features/inventory/components/InventoryItemMenuHeader.vue'
import InventoryItemTooltip from '@/features/inventory/components/InventoryItemTooltip.vue'
import { useInventoryTooltip } from '@/features/inventory/composables/useInventoryTooltip'
import InventoryBagItem from '@/features/inventory/components/InventoryBagItem.vue'
import { inventoryCellTraits } from '@/features/inventory/lib/cellTraits'
import { pvAvatar, pvName } from '../lib/participantView'
const props = defineProps({ row: Object, item: Object, players: Array, busy: Boolean, controller: Object, sortable: Object, index: Number })
defineEmits(['view', 'remove'])
const { tooltip, showTooltip, hideTooltip } = useInventoryTooltip()
const traits = computed(() => inventoryCellTraits(props.item, props.row.entry))
const display = computed(() => {
  const override = props.row.entry?.override || {}, data = props.item?.data || {}
  return { name: props.row.name, base: props.item,
    desc: override.desc ?? props.row.entry?.desc ?? data.desc ?? '',
    cost: override.cost ?? data.cost, weight: override.weight ?? data.weight,
    consumable: override.consumable ?? data.consumable,
  }
})
watch(display, value => { if (tooltip.visible) showTooltip({ currentTarget: tooltip.anchor }, value) })
async function send(player, closeRecipients, close) { if (await props.controller.send(props.row, player)) { closeRecipients(); close() } }
</script>
<style scoped>
.inventory-player :deep(.ram-item__icon), .inventory-player img { width: 48px; height: 48px; flex: 0 0 48px; object-fit: contain; }
.inventory-no-players { margin: 8px; color: var(--text-muted); font-size: 12px; }
</style>
