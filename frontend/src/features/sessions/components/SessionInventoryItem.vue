<template>
  <RowActionMenu related block :disabled="busy || sortable.suppressNextClick" :title="row.name">
    <template #trigger="{ open }">
      <InventoryBagItem :item-key="row.id" :item="item" :name="row.name" :count="row.entry?.count" :source="sortable.isSource(row)" :draggable="!busy" :disabled="busy || sortable.suppressNextClick"
        :class="{ 'action-menu-source--open': open }" @pointerdown="!busy && sortable.startDrag($event, row, 'session-inventory', index)" />
    </template>
    <template #default="{ close }">
      <p class="inventory-item-name">{{ row.name }}</p>
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
</template>
<script setup>
import { Send, UserRound } from '@lucide/vue'
import { RowActionMenu, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import InventoryBagItem from '@/features/inventory/components/InventoryBagItem.vue'
import { pvAvatar, pvName } from '../lib/participantView'
const props = defineProps({ row: Object, item: Object, players: Array, busy: Boolean, controller: Object, sortable: Object, index: Number })
defineEmits(['view', 'remove'])
async function send(player, closeRecipients, close) { if (await props.controller.send(props.row, player)) { closeRecipients(); close() } }
</script>
<style scoped>
.inventory-item-name { margin: 6px 8px; color: var(--text-1); font-weight: 700; overflow-wrap: anywhere; }
.inventory-player :deep(.ram-item__icon), .inventory-player img { width: 48px; height: 48px; flex: 0 0 48px; object-fit: contain; }
.inventory-no-players { margin: 8px; color: var(--text-muted); font-size: 12px; }
</style>
