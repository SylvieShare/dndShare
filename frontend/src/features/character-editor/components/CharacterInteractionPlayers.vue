<template>
  <div class="interaction-players">
    <RowActionMenu v-for="player in players" :key="player.charUuid" :title="`Действия: ${pvName(player) || 'Без имени'}`">
      <template #trigger="{ open }">
        <BaseTile interactive role="button" tabindex="0" aria-haspopup="menu" :aria-expanded="open" :aria-label="`Действия: ${pvName(player) || 'Без имени'}`" @keydown.enter.prevent="$event.currentTarget.click()" @keydown.space.prevent="$event.currentTarget.click()" class="interaction-player" :class="{ 'action-menu-source--open': open }">
          <TransferPerson class="interaction-player-person" :name="pvName(player) || 'Без имени'" :image-url="pvAvatar(player)" :size="48">
            <SessionHpBar v-if="pvHp(player)" :hp="pvHp(player)" />
          </TransferPerson>
        </BaseTile>
      </template>
      <template #default="{ close }">
        <div data-share-popover-related>
        <RowActionItem v-if="player.canOpenSheet" action="view" @click="openSheet(player, close)">Открыть лист</RowActionItem>
        <RowActionItem v-if="money" :icon="Coins" @click="giveMoney(player, close)">Дать денег</RowActionItem>
        <RowActionItem :icon="MessageCircle" @click="select(player, 'chat', close)">Чат</RowActionItem>
        <RowActionItem :icon="Hand" @click="select(player, 'rps', close)">Камень / ножницы / бумага</RowActionItem>
        </div>
      </template>
    </RowActionMenu>
    <p v-if="!players.length" class="interaction-empty">Других игроков пока нет.</p>
  </div>
</template>
<script setup>
import { useRouter } from 'vue-router'
import { BaseTile, RowActionMenu } from '@sylvieshare/share-ui'
import { Coins, Hand, MessageCircle } from '@lucide/vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import TransferPerson from '@/features/item-transfers/components/TransferPerson.vue'
import SessionHpBar from '@/features/sessions/components/SessionHpBar.vue'
import { pvAvatar, pvName, pvHp } from '@/features/sessions/lib/participantView'
const props = defineProps({ players: { type: Array, required: true }, controller: { type: Object, required: true }, money: { type: Object, default: null } })
const router = useRouter()
function openSheet(player, close) {
  if (!player.canOpenSheet) return
  close()
  router.push({ path: `/char/${player.charUuid}` })
}
function select(player, mode, close) {
  close()
  props.controller.open({ charUuid: player.charUuid, name: pvName(player) || 'Без имени', imageUrl: pvAvatar(player) }, mode)
}
function giveMoney(player, close) {
  close()
  props.money.open({ charUuid: player.charUuid, name: pvName(player) || 'Без имени', imageUrl: pvAvatar(player) })
}
</script>
<style scoped>
.interaction-players { display: grid; gap: 6px; }
.interaction-player { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px; text-align: left; width: 100%; }
.interaction-player-person { width: 100%; }
.interaction-empty { color: var(--text-muted); font-size: 13px; }
</style>
