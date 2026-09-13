<template>
  <AppModalFrame v-if="state.view" :title="title" :width="520" :z-index="3400" close-label="Закрыть"
    :dismissible="!state.busy" :show-close="!state.busy" @close="controller.close">
    <div class="transfer-content" :aria-busy="state.busy">
      <p v-if="state.error" class="transfer-error" role="alert">{{ state.error }}</p>
      <LoadingIndicator v-if="state.loading" label="Загрузка игроков" />
      <template v-else-if="state.view === 'players'">
        <div v-for="player in state.participants" :key="player.charUuid" class="transfer-player">
          <img v-if="pvAvatar(player)" :src="pvAvatar(player)" alt="" class="transfer-avatar" />
          <span v-else class="transfer-initial" aria-hidden="true">{{ (pvName(player) || '?').slice(0, 1) }}</span>
          <span>{{ pvName(player) || 'Без имени' }}<small v-if="player.charUuid === characterUuid">Ваш персонаж</small></span>
        </div>
        <p v-if="!state.participants.length" class="transfer-hint">Участников пока нет.</p>
      </template>
      <template v-else-if="state.view === 'send'">
        <p class="transfer-item">{{ state.selection?.name }}<span v-if="state.selection?.count > 1"> ×{{ state.selection.count }}</span></p>
        <p class="transfer-hint">Предмет будет убран из вашего инвентаря до ответа игрока. При отказе он вернётся. Передаётся вся стопка.</p>
        <FormField label="Кому передать">
          <FormSelect v-model:value="state.recipient" :disabled="state.busy">
            <option value="" disabled>Выберите персонажа</option>
            <option v-for="player in controller.recipients" :key="player.charUuid" :value="player.charUuid">{{ pvName(player) || 'Без имени' }}</option>
          </FormSelect>
        </FormField>
        <p v-if="!controller.recipients.length" class="transfer-hint">В сессии пока нет других персонажей.</p>
      </template>
      <template v-else>
        <p v-if="!state.transfers.length" class="transfer-hint">Незавершённых событий нет.</p>
        <BaseTile v-for="transfer in state.transfers" :key="transfer.id" class="transfer-event">
          <strong>{{ transfer.itemName }}<span v-if="transfer.entry?.count > 1"> ×{{ transfer.entry.count }}</span></strong>
          <span class="transfer-hint">{{ transfer.senderName }} → {{ transfer.recipientName }}</span>
          <template v-if="transfer.recipientCharUuid === characterUuid">
            <span class="transfer-hint">Ожидает вашего решения</span>
            <div class="transfer-actions">
              <ActionButton :disabled="state.busy" @click="controller.resolve(transfer, 'accept')">Принять</ActionButton>
              <ActionButton variant="quiet" :disabled="state.busy" @click="controller.resolve(transfer, 'reject')">Отказаться</ActionButton>
            </div>
          </template>
          <template v-else>
            <span class="transfer-hint">Ожидает принятия</span>
            <ActionButton variant="quiet" :disabled="state.busy" @click="controller.resolve(transfer, 'reject')">Отозвать передачу</ActionButton>
          </template>
        </BaseTile>
      </template>
    </div>
    <template #footer>
      <div class="transfer-actions">
        <ActionButton v-if="state.view === 'send'" :disabled="state.busy || state.loading || !state.recipient" @click="controller.send">{{ state.busy ? 'Передача…' : 'Передать' }}</ActionButton>
        <ActionButton v-else variant="quiet" :disabled="state.busy" @click="controller.open(state.view)">Обновить</ActionButton>
        <ActionButton variant="quiet" :disabled="state.busy" @click="controller.close">Закрыть</ActionButton>
      </div>
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed } from 'vue'
import { ActionButton, AppModalFrame, BaseTile, FormField, FormSelect, LoadingIndicator } from '@sylvieshare/share-ui'
import { pvAvatar, pvName } from '@/features/sessions/lib/participantView'
const props = defineProps({ controller: { type: Object, required: true }, characterUuid: { type: String, required: true } })
const state = computed(() => props.controller.state)
const title = computed(() => ({ players: 'Игроки сессии', send: 'Передать другому игроку', events: 'События' })[state.value.view])
</script>

<style scoped>
.transfer-content { display: flex; flex-direction: column; gap: 16px; }
.transfer-content p { margin: 0; }
.transfer-player { display: flex; align-items: center; gap: 12px; overflow-wrap: anywhere; }
.transfer-player small { display: block; color: var(--text-muted); font-size: 12px; }
.transfer-avatar, .transfer-initial { width: 44px; height: 44px; flex: 0 0 44px; object-fit: cover; }
.transfer-initial { display: grid; place-items: center; color: var(--accent); font-size: 24px; }
.transfer-item { font-size: 18px; font-weight: 650; overflow-wrap: anywhere; }
.transfer-event { display: flex; flex-direction: column; gap: 8px; padding: 14px; overflow-wrap: anywhere; }
.transfer-hint { color: var(--text-muted); font-size: 13px; line-height: 1.5; }
.transfer-error { color: var(--danger); }
.transfer-actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
