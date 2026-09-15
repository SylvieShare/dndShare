<template>
  <div class="session-event-notification">
    <div class="session-event-notification-author">
      <SessionEventActorAvatar :event="event" :label="actorLabel" />
      <div><strong class="session-event-notification-name"><NpcMarker v-if="event.data?.npcActor?.letter" :letter="event.data.npcActor.letter" :color="event.data.npcActor.color" />{{ actorLabel }}</strong><small v-if="sessionEventActorKind(event) !== 'creature'">{{ event.authorName }}</small></div>
    </div>
    <p class="session-event-notification-action">{{ event.action }}<template v-if="transition"> ({{ transition }})</template></p>
    <p v-if="details" class="session-event-notification-detail">{{ details }}</p>
    <DiceRollResult v-if="event.data?.result" :result="event.data.result" :color="event.data.color" :size="30" />
    <ApplicationSummary v-if="event.data?.applicationResult" :data="event.data.applicationResult" result />
    <small v-if="entry.data.updated" class="session-event-notification-detail">Событие обновлено</small>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import ApplicationSummary from '@/features/character-editor/components/ApplicationSummary.vue'
import SessionEventActorAvatar from '@/features/sessions/components/SessionEventActorAvatar.vue'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import NpcMarker from '@/features/sessions/components/NpcMarker.vue'
import { sessionEventActorKind, sessionEventActorLabel } from '@/features/sessions/lib/sessionEventView'
import { sessionEventDetails, sessionEventTransition } from '@/features/sessions/lib/sessionEventEntity'
const props = defineProps({ entry: { type: Object, required: true } })
const event = computed(() => props.entry.data.event)
const actorLabel = computed(() => sessionEventActorLabel(event.value) || (event.value.authorIsSessionOwner ? 'Мастер' : event.value.authorName || 'Сессия'))
const details = computed(() => sessionEventDetails(event.value))
const transition = computed(() => sessionEventTransition(event.value))
</script>
<style scoped>
.session-event-notification { display: grid; gap: 8px; min-width: 0; overflow-wrap: anywhere; }
.session-event-notification-author { display: flex; align-items: center; gap: 9px; padding-right: 24px; }
.session-event-notification-name { display: flex; align-items: baseline; gap: 6px; }
.session-event-notification-author > div { display: grid; gap: 3px; min-width: 0; }
.session-event-notification-author small, .session-event-notification-detail { color: var(--text-muted); font-size: 12px; }
.session-event-notification-action, .session-event-notification-detail { margin: 0; }
.session-event-notification-action { font-size: 14px; color: var(--text-1); }
</style>
