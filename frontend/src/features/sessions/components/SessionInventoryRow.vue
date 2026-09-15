<template>
  <div class="inventory-row">
    <button type="button" class="inventory-reference" @click="$emit('view', row)">
      <ItemIcon v-if="item?.iconImageUrl || item?.svg" :item="item" :size="36" /><Package v-else :size="32" />
      <strong>{{ row.name }}<span v-if="row.entry?.count > 1"> ×{{ row.entry.count }}</span></strong>
    </button>
    <RowActionSubmenu label="Кому передать" :min-width="260" :disabled="busy">
      <template #trigger><ActionButton variant="quiet" :disabled="busy" :aria-label="`Передать: ${row.name}`"><template #icon><Send :size="16" /></template>Передать</ActionButton></template>
      <template #default="{ close }">
        <p v-if="!players.length" class="inventory-no-players">В сессии пока нет игроков</p>
        <RowActionItem v-for="player in players" :key="player.charUuid" :disabled="busy" class="inventory-player" @click="send(player, close)">
          <template #icon><img v-if="pvAvatar(player)" :src="pvAvatar(player)" alt="" /><UserRound v-else :size="36" /></template>
          {{ pvName(player) || 'Без имени' }}
        </RowActionItem>
      </template>
    </RowActionSubmenu>
    <RemoveButton icon="trash" :label="`Удалить: ${row.name}`" :disabled="busy" @click="$emit('remove', row)" />
  </div>
</template>
<script setup>
import { Package, Send, UserRound } from '@lucide/vue'
import { ActionButton, RemoveButton, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { pvAvatar, pvName } from '../lib/participantView'
const props = defineProps({ row: Object, item: Object, players: Array, busy: Boolean, controller: Object })
defineEmits(['view', 'remove'])
async function send(player, close) { if (await props.controller.send(props.row, player)) close() }
</script>
<style scoped>
.inventory-row { display: flex; align-items: center; gap: 12px; padding-block: 10px; }
.inventory-row + .inventory-row { border-top: 1px solid var(--border); }
.inventory-reference { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; padding: 0; border: 0; background: none; color: var(--text-1); font: inherit; text-align: left; cursor: pointer; }
.inventory-reference > svg { flex: none; color: var(--accent-soft); }
.inventory-reference strong { font-size: 14px; overflow-wrap: anywhere; }
.inventory-player :deep(.ram-item__icon), .inventory-player img { width: 48px; height: 48px; flex: 0 0 48px; object-fit: contain; }
.inventory-no-players { margin: 8px; color: var(--text-muted); font-size: 12px; }
</style>
