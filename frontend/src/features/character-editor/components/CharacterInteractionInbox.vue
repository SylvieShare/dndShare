<template>
  <div v-if="controller.state.pending.length || controller.state.error" class="interaction-inbox">
    <p v-if="controller.state.error" role="alert" class="interaction-error">{{ controller.state.error }}</p>
    <article v-for="entry in entries" :key="entry.key" class="interaction-incoming">
      <TransferPerson :name="entry.name" :image-url="entry.imageUrl" />
      <span>{{ entry.label }}</span>
      <ActionButton variant="quiet" @click="controller.openEvent(entry.event)">{{ entry.event.type === 'chat_message' ? 'Открыть чат' : 'Открыть вызов' }}</ActionButton>
    </article>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import TransferPerson from '@/features/item-transfers/components/TransferPerson.vue'
import { interactionPeer, interactionPeerName } from '@/features/sessions/lib/sessionInteractions'
const props = defineProps({ controller: { type: Object, required: true }, characterUuid: { type: String, required: true } })
const entries = computed(() => {
  const grouped = new Map()
  for (const event of props.controller.state.pending) {
    const key = event.type === 'chat_message' ? `chat:${interactionPeer(event, props.characterUuid)}` : `rps:${event.id}`
    const incoming = event.data.recipientCharUuid === props.characterUuid
    const entry = grouped.get(key) || { key, event, count: 0, name: interactionPeerName(event, props.characterUuid), imageUrl: incoming ? event.actorImageUrl : event.recipientImageUrl }
    entry.count++
    entry.label = event.type === 'chat_message' ? `Непрочитанных сообщений: ${entry.count}` : incoming ? 'Вызывает в камень / ножницы / бумага' : 'Ожидает ответа на ваш вызов'
    grouped.set(key, entry)
  }
  return [...grouped.values()]
})
</script>
<style scoped>
.interaction-inbox { display: grid; gap: 16px; }
.interaction-incoming { display: grid; justify-items: start; gap: 8px; overflow-wrap: anywhere; }
.interaction-incoming + .interaction-incoming { border-top: 1px solid var(--border); padding-top: 16px; }
.interaction-incoming > span { color: var(--text-muted); font-size: 13px; }
.interaction-error { color: var(--danger); }
</style>
