<template>
  <RowActionItem v-if="ctx.ownerMode && purpose === 'use' && (!ctx.topSession || !interactionAllowed) && !entry?.params?.magic?.lost" :icon="Pill" :disabled="disabled || controller?.state.busy" @click="emit('self')">{{ effectLabel || 'Использовать на себя' }}</RowActionItem>
  <RowActionSubmenu v-else-if="ctx.ownerMode && ctx.topSession && interactionAllowed && ctx.itemTransfers && !entry?.params?.magic?.lost" :min-width="260" :disabled="disabled || controller.state.busy">
    <template #trigger="{ open }">
      <RowActionItem :icon="purpose === 'use' ? Pill : Send" submenu :submenu-open="open" :disabled="disabled || controller.state.busy" @click="!open && controller.loadPlayers()">{{ purpose === 'use' ? effectLabel || 'Использовать на…' : 'Передать' }}</RowActionItem>
    </template>
    <template #default="{ close }">
      <RowActionItem v-if="purpose === 'use'" :icon="UserRound" :disabled="disabled || controller.state.busy" @click="emit('self'); close()">На себя</RowActionItem>
      <LoadingIndicator v-if="controller.state.loading" label="Загрузка игроков" />
      <p v-if="controller.state.error" class="transfer-menu-message transfer-menu-error" role="alert">{{ controller.state.error }}</p>
      <template v-if="!controller.state.loading">
        <RowActionItem :icon="Crown" :disabled="disabled || controller.state.busy" @click="send({ charUuid: 'dm' }, close)">{{ purpose === 'use' ? 'Мастер — выберет цель' : 'Мастер — инвентарь сессии' }}</RowActionItem>
        <p v-if="!controller.recipients.length && purpose !== 'use'" class="transfer-menu-message">В сессии пока нет других игроков.</p>
        <RowActionItem v-for="player in controller.recipients" :key="player.charUuid" class="transfer-recipient" :disabled="disabled || controller.state.busy" @click="send(player, close)">
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
import { Crown, Pill, Send, UserRound } from '@lucide/vue'
import { LoadingIndicator, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { pvAvatar, pvName } from '@/features/sessions/lib/participantView'
const props = defineProps({ effectLabel: { type: String, default: '' }, optionKey: { type: String, default: '' }, purpose: { type: String, default: 'transfer' }, disabled: Boolean, source: { type: String, required: true }, entry: { type: Object, required: true }, name: { type: String, default: 'Предмет' } })
const emit = defineEmits(['close', 'self'])
const ctx = inject('charCtx', {})
const controller = computed(() => ctx.itemTransfers)
const interactionAllowed = computed(() => controller.value?.state.settings?.interactions?.[props.purpose === 'use' ? props.source === 'spells' ? 'spells' : 'potions' : 'items'] !== false)
async function send(player, close) {
  if (!props.disabled && await controller.value.send(props.source, props.entry, player.charUuid, props.purpose, props.optionKey)) { close(); emit('close') }
}
</script>
<style scoped>
.transfer-recipient :deep(.ram-item__icon) { width: 48px; height: 48px; flex: 0 0 48px; }
.transfer-recipient img { width: 48px; height: 48px; object-fit: contain; }
.transfer-recipient :deep(.ram-item__icon) > span { color: var(--accent-soft); font-size: 26px; font-weight: 700; }
.transfer-menu-message { margin: 8px; font-size: 12px; color: var(--text-muted); }
.transfer-menu-error { color: var(--danger); }
</style>
