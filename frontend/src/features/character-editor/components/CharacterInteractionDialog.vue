<template>
  <AppModalFrame v-if="state.peer" :title="state.peer.name" :z-index="3600" width="560px" close-label="Закрыть" :dismissible="!state.busy" @close="controller.close">
    <div class="interaction-dialog" :aria-busy="state.busy">
      <MultiToggle v-model="state.mode" :options="modes" aria-label="Общение с игроком" />
      <p class="interaction-hint">Сообщения и партии сохраняются в хронике. Их видите вы, собеседник и мастер.</p>
      <p v-if="state.error" role="alert" class="interaction-error">{{ state.error }}</p>
      <ActionButton v-if="state.error" variant="quiet" :disabled="state.busy || state.loading" @click="controller.refresh">Обновить</ActionButton>
      <div v-if="state.mode === 'rps'" class="interaction-game">
        <template v-if="round">
          <p>{{ incoming ? 'Вас вызывают в камень / ножницы / бумага. Сделайте выбор — затем откроются оба хода.' : 'Ваш выбор сохранён. Ждём ответа соперника.' }}</p>
          <div v-if="incoming" class="interaction-choices">
            <ActionButton v-for="choice in RPS_CHOICES" :key="choice.value" :disabled="state.busy" @click="controller.resolve(round, choice.value)">{{ choice.symbol }} {{ choice.label }}</ActionButton>
          </div>
          <ActionButton variant="quiet" :disabled="state.busy" @click="controller.resolve(round, incoming ? 'decline' : 'cancel')">{{ incoming ? 'Отклонить вызов' : 'Отозвать вызов' }}</ActionButton>
        </template>
        <template v-else>
          <p>Выберите ход, чтобы вызвать игрока. Соперник не увидит его до своего ответа.</p>
          <div class="interaction-choices">
            <ActionButton v-for="choice in RPS_CHOICES" :key="choice.value" :disabled="state.busy || state.loading" @click="controller.send('rps_challenge', choice.value)">{{ choice.symbol }} {{ choice.label }}</ActionButton>
          </div>
        </template>
      </div>
      <LoadingIndicator v-if="state.loading && !state.history.length" label="Загрузка переписки" />
      <ActionButton v-if="state.hasMore" variant="quiet" :disabled="state.loading || state.busy" @click="controller.loadOlder">Загрузить раньше</ActionButton>
      <div class="interaction-history" role="log" aria-label="История общения" aria-live="polite" aria-relevant="additions text">
        <p v-if="!visibleHistory.length && !state.loading" class="interaction-hint">{{ state.mode === 'chat' ? 'Сообщений пока нет.' : 'Завершённых партий пока нет.' }}</p>
        <article v-for="event in visibleHistory" :key="event.id" class="interaction-entry" :class="{ 'interaction-entry--own': event.data.senderCharUuid === characterUuid }">
          <div class="interaction-entry-heading"><strong>{{ event.data.senderCharUuid === characterUuid ? 'Вы' : event.data.senderName }}</strong><time :datetime="event.createdAt">{{ formatTime(event.createdAt) }}</time></div>
          <p v-if="event.type === 'chat_message'" class="interaction-message">{{ event.data.message }}</p>
          <p v-else>{{ interactionDetails(event) }}</p>
        </article>
        <span ref="historyEnd" aria-hidden="true" />
      </div>
    </div>
    <template v-if="state.mode === 'chat'" #footer>
      <form class="interaction-composer" @submit.prevent="sendMessage">
        <FormTextarea v-model:value="draft" aria-label="Сообщение" placeholder="Написать сообщение…" :maxlength="2000" :rows="3" :disabled="state.busy" @keydown.ctrl.enter.prevent="sendMessage" @keydown.meta.enter.prevent="sendMessage" />
        <ActionButton type="submit" :disabled="!draft.trim() || state.busy || state.loading">{{ state.busy ? 'Отправка…' : 'Отправить' }}</ActionButton>
      </form>
    </template>
  </AppModalFrame>
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ActionButton, AppModalFrame, FormTextarea, LoadingIndicator, MultiToggle } from '@sylvieshare/share-ui'
import { interactionDetails, RPS_CHOICES } from '@/features/sessions/lib/sessionInteractions'
const props = defineProps({ controller: { type: Object, required: true }, characterUuid: { type: String, required: true } })
const state = computed(() => props.controller.state)
const round = computed(() => props.controller.currentRound)
const incoming = computed(() => round.value?.data.recipientCharUuid === props.characterUuid)
const draft = ref('')
const historyEnd = ref(null)
const modes = [{ value: 'chat', label: 'Чат' }, { value: 'rps', label: 'Камень / ножницы / бумага' }]
const visibleHistory = computed(() => state.value.history.filter(event => state.value.mode === 'chat' || (event.type === 'rps_challenge' && event.data.status !== 'pending')))
watch(() => state.value.peer?.charUuid, () => { draft.value = '' })
watch(() => [state.value.peer?.charUuid, state.value.mode, state.value.history.at(-1)?.id], async () => {
  await nextTick()
  if (state.value.mode === 'chat') historyEnd.value?.scrollIntoView({ block: 'nearest' })
})
function formatTime(value) { return new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
async function sendMessage() {
  if (!draft.value.trim() || state.value.busy || state.value.loading) return
  if (await props.controller.send('chat_message', draft.value)) draft.value = ''
}
</script>
<style scoped>
.interaction-dialog { display: grid; gap: 16px; min-width: 0; }
.interaction-dialog p { margin: 0; }
.interaction-hint { color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.interaction-error { color: var(--danger); }
.interaction-game { display: grid; justify-items: start; gap: 12px; font-size: 14px; line-height: 1.5; }
.interaction-choices { display: flex; flex-wrap: wrap; gap: 8px; }
.interaction-history { display: grid; gap: 12px; min-width: 0; }
.interaction-entry { display: grid; gap: 6px; border-left: 2px solid var(--border-strong); padding: 4px 0 4px 12px; overflow-wrap: anywhere; font-size: 14px; line-height: 1.5; }
.interaction-entry--own { border-color: var(--accent); }
.interaction-entry-heading { display: flex; align-items: baseline; flex-wrap: wrap; justify-content: space-between; gap: 8px; font-size: 12px; }
.interaction-entry-heading time { color: var(--text-muted); font-size: 11px; }
.interaction-message { white-space: pre-wrap; }
.interaction-composer { display: grid; justify-items: stretch; gap: 10px; width: 100%; }
.interaction-composer > button { justify-self: end; }
</style>
