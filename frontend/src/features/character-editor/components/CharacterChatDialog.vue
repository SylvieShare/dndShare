<template>
  <AppModalFrame :title="`Чат — ${state.peer.name}`" :z-index="3600" width="600px" close-label="Закрыть" :dismissible="!state.busy" @close="controller.close">
    <template #title><div class="chat-heading"><span>Чат</span><TransferPerson :name="state.peer.name" :image-url="state.peer.imageUrl" /></div></template>
    <div class="interaction-dialog" :aria-busy="state.busy">
      <p class="interaction-hint">Переписку видите вы, собеседник и мастер.</p>
      <p v-if="state.error" role="alert" class="interaction-error">{{ state.error }}</p>
      <ActionButton v-if="state.error" variant="quiet" :disabled="state.busy || state.loading" @click="controller.refresh">Обновить</ActionButton>
      <LoadingIndicator v-if="state.loading && !state.history.length" label="Загрузка переписки" />
      <ActionButton v-if="state.hasMore" variant="quiet" :disabled="state.loading || state.busy" @click="controller.loadOlder">Загрузить раньше</ActionButton>
      <div class="interaction-history" role="log" aria-label="История общения" aria-live="polite" aria-relevant="additions text">
        <p v-if="!state.history.length && !state.loading" class="interaction-hint">Сообщений пока нет.</p>
        <article v-for="event in state.history" :key="event.id" class="interaction-entry" :class="{ 'interaction-entry--own': event.data.senderCharUuid === characterUuid }" :aria-label="`Отправитель: ${event.data.senderName}`">
          <SessionEventActorAvatar class="interaction-avatar" :event="event" :label="event.data.senderName" />
          <div class="interaction-entry-body">
            <time :datetime="event.createdAt">{{ formatTime(event.createdAt) }}</time>
            <p v-if="event.type === 'chat_message'" class="interaction-message">{{ event.data.message }}</p>
            <RpsResult v-else-if="event.data.status === 'completed'" :event="event" compact />
            <template v-else>
              <p class="interaction-hint">{{ roundStatus(event) }}</p>
              <ActionButton v-if="event.data.status === 'pending'" variant="quiet" :disabled="state.busy" @click="controller.openEvent(event)">Открыть вызов</ActionButton>
            </template>
          </div>
        </article>
        <span ref="historyEnd" aria-hidden="true" />
      </div>
    </div>
    <template #footer>
      <form class="interaction-composer" @submit.prevent="sendMessage">
        <FormTextarea v-model:value="draft" aria-label="Сообщение" placeholder="Написать сообщение…" :maxlength="2000" :rows="3" :disabled="state.busy" @keydown.ctrl.enter.prevent="sendMessage" @keydown.meta.enter.prevent="sendMessage" />
        <ActionButton type="submit" :disabled="!draft.trim() || state.busy || state.loading">{{ state.busy ? 'Отправка…' : 'Отправить' }}</ActionButton>
      </form>
    </template>
  </AppModalFrame>
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ActionButton, AppModalFrame, FormTextarea, LoadingIndicator } from '@sylvieshare/share-ui'
import TransferPerson from '@/features/item-transfers/components/TransferPerson.vue'
import SessionEventActorAvatar from '@/features/sessions/components/SessionEventActorAvatar.vue'
import RpsResult from '@/features/sessions/components/RpsResult.vue'
const props = defineProps({ controller: { type: Object, required: true }, characterUuid: { type: String, required: true } })
const state = computed(() => props.controller.state)
const draft = ref('')
const historyEnd = ref(null)
const roundStatus = event => ({ pending: 'Камень / ножницы / бумага — ожидает ответа', declined: 'Вызов отклонён', cancelled: 'Вызов отозван' })[event.data.status] || ''
watch(() => state.value.peer?.charUuid, () => { draft.value = '' })
watch(() => [state.value.peer?.charUuid, state.value.history.at(-1)?.id, state.value.history.at(-1)?.data.status], async () => {
  await nextTick()
  historyEnd.value?.scrollIntoView({ block: 'nearest' })
})
function formatTime(value) { return new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
async function sendMessage() {
  if (!draft.value.trim() || state.value.busy || state.value.loading) return
  if (await props.controller.send('chat_message', draft.value)) draft.value = ''
}
</script>
<style scoped>
.chat-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.chat-heading > span { color: var(--text-muted); font-size: 12px; }
.interaction-dialog { display: grid; gap: 16px; min-width: 0; }
.interaction-dialog p { margin: 0; }
.interaction-hint { color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.interaction-error { color: var(--danger); }
.interaction-history { display: grid; gap: 16px; min-width: 0; }
.interaction-entry { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 10px; min-width: 0; font-size: 14px; line-height: 1.5; }
.interaction-avatar { width: 36px; height: 36px; flex-basis: 36px; }
.interaction-entry-body { display: grid; gap: 8px; min-width: 0; border-left: 2px solid var(--border-strong); padding: 4px 0 4px 12px; overflow-wrap: anywhere; }
.interaction-entry--own .interaction-entry-body { border-color: var(--accent); }
.interaction-entry-body time { color: var(--text-muted); font-size: 10px; justify-self: end; }
.interaction-message { white-space: pre-wrap; }
.interaction-composer { display: grid; justify-items: stretch; gap: 10px; width: 100%; }
.interaction-composer > button { justify-self: end; }
</style>
