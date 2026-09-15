<template>
  <div class="inventory-row">
    <button type="button" class="inventory-reference" :title="row.name" @click="$emit('view', row)">
      <ObjectListItem :item="{ ...item, name: row.name }" :show-chevron="false">
        <template #icon-fallback><Package :size="32" /></template>
        <template #name-extras><span v-if="row.entry?.count > 1" class="inventory-count">×{{ row.entry.count }}</span></template>
      </ObjectListItem>
    </button>
    <div class="inventory-actions">
      <RowActionSubmenu label="Кому передать" :min-width="260" :mobile-breakpoint="0" :disabled="busy">
        <template #trigger><ActionButton variant="quiet" icon-only :disabled="busy" :aria-label="`Передать: ${row.name}`" title="Передать"><template #icon><Send :size="20" /></template></ActionButton></template>
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
  </div>
</template>
<script setup>
import { Package, Send, UserRound } from '@lucide/vue'
import { ActionButton, RemoveButton, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem.vue'
import { pvAvatar, pvName } from '../lib/participantView'
const props = defineProps({ row: Object, item: Object, players: Array, busy: Boolean, controller: Object })
defineEmits(['view', 'remove'])
async function send(player, close) { if (await props.controller.send(props.row, player)) close() }
</script>
<style scoped>
.inventory-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; min-width: 0; padding-block: 8px; }
.inventory-row + .inventory-row { border-top: 1px solid var(--border); }
.inventory-reference { min-width: 0; width: 100%; padding: 0; border: 0; background: none; color: var(--text-1); font: inherit; text-align: left; cursor: pointer; }
.inventory-actions { display: flex; align-items: center; gap: 4px; }
.inventory-count { flex: none; color: var(--text-muted); font-size: 12px; }
.inventory-player :deep(.ram-item__icon), .inventory-player img { width: 48px; height: 48px; flex: 0 0 48px; object-fit: contain; }
.inventory-no-players { margin: 8px; color: var(--text-muted); font-size: 12px; }
</style>
