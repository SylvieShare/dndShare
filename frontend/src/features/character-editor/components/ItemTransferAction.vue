<template>
  <RowActionSubmenu v-if="ctx.ownerMode && ctx.topSession && ctx.itemTransfers && !entry?.params?.magic?.lost" :label="`Кому предложить: ${name}`" :min-width="260" :disabled="controller.state.busy">
    <template #trigger="{ open }">
      <RowActionItem :icon="Send" submenu :submenu-open="open" :disabled="controller.state.busy" @click="!open && controller.loadPlayers()">Передать другому игроку</RowActionItem>
    </template>
    <template #default="{ close }">
      <LoadingIndicator v-if="controller.state.loading" label="Загрузка игроков" />
      <p v-if="controller.state.error" class="transfer-menu-message transfer-menu-error" role="alert">{{ controller.state.error }}</p>
      <template v-if="!controller.state.loading">
        <p v-if="!controller.recipients.length" class="transfer-menu-message">В сессии пока нет других игроков.</p>
        <RowActionItem v-for="player in controller.recipients" :key="player.charUuid" class="transfer-recipient" :disabled="controller.state.busy" @click="send(player, close)">
          <template #icon>
            <img v-if="pvAvatar(player)" :src="pvAvatar(player)" alt="" />
            <span v-else>{{ (pvName(player) || '?').slice(0, 1) }}</span>
          </template>
          {{ pvName(player) || 'Без имени' }}
        </RowActionItem>
      </template>
    </template>
  </RowActionSubmenu>
</template>
<script setup>
import { computed, inject } from 'vue'
import { Send } from '@lucide/vue'
import { LoadingIndicator, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { pvAvatar, pvName } from '@/features/sessions/lib/participantView'
const props = defineProps({ source: { type: String, required: true }, entry: { type: Object, required: true }, name: { type: String, default: 'Предмет' } })
const emit = defineEmits(['close'])
const ctx = inject('charCtx', {})
const controller = computed(() => ctx.itemTransfers)
async function send(player, close) {
  if (await controller.value.send(props.source, props.entry, player.charUuid)) { close(); emit('close') }
}
</script>
<style scoped>
.transfer-recipient :deep(.ram-item__icon) { width: 48px; height: 48px; flex: 0 0 48px; }
.transfer-recipient img { width: 48px; height: 48px; object-fit: contain; }
.transfer-recipient :deep(.ram-item__icon) > span { color: var(--accent-soft); font-size: 26px; font-weight: 700; }
.transfer-menu-message { margin: 8px; font-size: 12px; color: var(--text-muted); }
.transfer-menu-error { color: var(--danger); }
</style>
