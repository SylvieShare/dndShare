<template>
  <AppModalFrame :title="`Камень / ножницы / бумага — ${state.peer.name}`" :z-index="3600" width="600px" close-label="Закрыть" :dismissible="!state.busy" @close="controller.close">
    <template #title><div class="rps-heading"><span>Камень / ножницы / бумага</span><TransferPerson :name="state.peer.name" :image-url="state.peer.imageUrl" /></div></template>
    <div class="rps-game" :aria-busy="state.busy" aria-live="polite">
      <p v-if="state.error" role="alert" class="rps-error">{{ state.error }}</p>
      <ActionButton v-if="state.error" variant="quiet" :disabled="state.busy || state.loading" @click="controller.refresh">Обновить</ActionButton>
      <LoadingIndicator v-if="state.loading" label="Загрузка партии" />
      <template v-else-if="round">
        <p class="rps-hint">{{ incoming ? 'Вас вызывают в камень / ножницы / бумага. Сделайте выбор — затем откроются оба хода.' : 'Ваш выбор сохранён. Ждём ответа соперника.' }}</p>
        <RpsChoices v-if="incoming" :disabled="state.busy" @choose="controller.resolve(round, $event)" />
        <ActionButton variant="quiet" :disabled="state.busy" @click="controller.resolve(round, incoming ? 'decline' : 'cancel')">{{ incoming ? 'Отклонить вызов' : 'Отозвать вызов' }}</ActionButton>
      </template>
      <div v-else-if="lastRound && !newRound" class="rps-finished">
        <RpsResult v-if="lastRound.data.status === 'completed'" :event="lastRound" />
        <p v-else class="rps-hint">{{ lastRound.data.status === 'declined' ? 'Вызов отклонён' : 'Вызов отозван' }}</p>
        <ActionButton :disabled="state.busy" @click="newRound = true"><template #icon><RotateCcw :size="18" /></template>Ещё раз</ActionButton>
      </div>
      <template v-else>
        <p class="rps-hint">Выберите ход, чтобы вызвать игрока. Соперник не увидит его до своего ответа.</p>
        <RpsChoices :disabled="state.busy" @choose="controller.send('rps_challenge', $event)" />
      </template>
      <p class="rps-note">Партии сохраняются в переписке и хронике. Их видите вы, соперник и мастер.</p>
    </div>
  </AppModalFrame>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { ActionButton, AppModalFrame, LoadingIndicator } from '@sylvieshare/share-ui'
import { RotateCcw } from '@lucide/vue'
import TransferPerson from '@/features/item-transfers/components/TransferPerson.vue'
import RpsResult from '@/features/sessions/components/RpsResult.vue'
import RpsChoices from './RpsChoices.vue'
const props = defineProps({ controller: { type: Object, required: true }, characterUuid: { type: String, required: true } })
const state = computed(() => props.controller.state)
const round = computed(() => props.controller.currentRound)
const incoming = computed(() => round.value?.data.recipientCharUuid === props.characterUuid)
const lastRound = computed(() => state.value.history.findLast(event => event.type === 'rps_challenge' && event.data.status !== 'pending'))
const newRound = ref(false)
watch(() => [state.value.peer?.charUuid, round.value?.id, lastRound.value?.id, lastRound.value?.data.status], () => { newRound.value = false })
</script>
<style scoped>
.rps-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-width: 0; }
.rps-game { display: grid; gap: 12px; min-width: 0; }
.rps-heading > span { color: var(--text-muted); font-size: 12px; }
.rps-game p { margin: 0; }
.rps-hint { color: var(--text-2); font-size: 14px; line-height: 1.5; }
.rps-note { color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.rps-error { color: var(--danger); }
.rps-finished { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; }
.rps-finished > button { margin-left: auto; }
</style>
