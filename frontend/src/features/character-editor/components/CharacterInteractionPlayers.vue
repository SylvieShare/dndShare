<template>
  <div class="interaction-players">
    <RowActionMenu v-for="player in players" :key="player.charUuid" :title="`Действия: ${pvName(player) || 'Без имени'}`">
      <template #trigger="{ open }">
        <BaseTile interactive role="button" tabindex="0" aria-haspopup="menu" :aria-expanded="open" :aria-label="`Действия: ${pvName(player) || 'Без имени'}`" @keydown.enter.prevent="$event.currentTarget.click()" @keydown.space.prevent="$event.currentTarget.click()" class="interaction-player" :class="{ 'action-menu-source--open': open }">
          <TransferPerson :name="pvName(player) || 'Без имени'" :image-url="pvAvatar(player)" />
          <Ellipsis :size="18" aria-hidden="true" />
        </BaseTile>
      </template>
      <template #default="{ close }">
        <div data-share-popover-related>
        <RowActionItem :icon="MessageCircle" @click="select(player, 'chat', close)">Чат</RowActionItem>
        <RowActionItem :icon="Hand" @click="select(player, 'rps', close)">Камень / ножницы / бумага</RowActionItem>
        </div>
      </template>
    </RowActionMenu>
    <p v-if="!players.length" class="interaction-empty">Других игроков пока нет.</p>
  </div>
</template>
<script setup>
import { BaseTile, RowActionMenu } from '@sylvieshare/share-ui'
import { Ellipsis, Hand, MessageCircle } from '@lucide/vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import TransferPerson from '@/features/item-transfers/components/TransferPerson.vue'
import { pvAvatar, pvName } from '@/features/sessions/lib/participantView'
const props = defineProps({ players: { type: Array, required: true }, controller: { type: Object, required: true } })
function select(player, mode, close) {
  close()
  props.controller.open({ charUuid: player.charUuid, name: pvName(player) || 'Без имени', imageUrl: pvAvatar(player) }, mode)
}
</script>
<style scoped>
.interaction-players { display: grid; gap: 6px; }
.interaction-player { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px; text-align: left; width: 100%; }
.interaction-player > svg { flex: none; color: var(--text-muted); }
.interaction-empty { color: var(--text-muted); font-size: 13px; }
</style>
