<template>
  <div
    class="session-event-actor-avatar"
    :class="`session-event-actor-avatar--${kind}`"
    :title="label || fallbackLabel"
    :aria-hidden="!markerLabel"
    :aria-label="markerLabel"
    :role="markerLabel ? 'img' : undefined"
  >
    <CharacterAvatar v-if="kind === 'character'" :src="imageUrl" :name="label || event.actorName" size="100%" />
    <img v-else-if="imageUrl" :src="imageUrl" alt="" />
    <span v-else-if="actorSvg" class="session-event-actor-svg" v-html="actorSvg" />
    <template v-else-if="kind === 'dm'">
      <Crown :size="25" :stroke-width="1.8" />
      <b>DM</b>
    </template>
    <span v-else-if="initial" class="session-event-actor-initial">{{ initial }}</span>
    <PawPrint v-else-if="kind === 'creature'" :size="28" :stroke-width="1.7" />
    <UserRound v-else :size="28" :stroke-width="1.7" />
    <NpcMarker v-if="markerLabel" class="session-event-actor-marker" :letter="marker.letter" :color="marker.color" shadow backed />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Crown, PawPrint, UserRound } from '@lucide/vue'
import CharacterAvatar from '@/features/character-editor/components/CharacterAvatar.vue'
import { pvAvatar } from '@/features/sessions/lib/participantView'
import { sessionEventActorKind } from '@/features/sessions/lib/sessionEventView'
import NpcMarker from './NpcMarker.vue'

const props = defineProps({
  event: { type: Object, required: true },
  label: { type: String, default: '' },
  marker: Object,
})

const kind = computed(() => sessionEventActorKind(props.event))
const markerLabel = computed(() => props.marker?.letter ? `Метка ${props.marker.letter}` : undefined)
const imageUrl = computed(() => {
  if (props.event?.actorImageUrl) return props.event.actorImageUrl
  if (kind.value !== 'character' || !props.event?.actorData) return ''
  return pvAvatar({
    templateId: props.event.actorTemplateId,
    data: props.event.actorData,
  }) || ''
})
const actorSvg = computed(() => kind.value === 'creature' ? props.event?.actorSvg || '' : '')
const initial = computed(() => String(props.label || props.event?.actorName || '').trim().slice(0, 1).toUpperCase())
const fallbackLabel = computed(() => ({
  dm: 'Мастер',
  creature: 'Существо',
  character: 'Персонаж',
  system: 'Системное событие',
})[kind.value])
</script>

<style scoped>
.session-event-actor-avatar { position: relative; width: 52px; height: 52px; display: grid; flex: 0 0 52px; place-items: center; color: var(--accent-soft); }
.session-event-actor-avatar img { width: 100%; height: 100%; display: block; object-fit: contain; }
.session-event-actor-svg { width: 100%; height: 100%; display: grid; place-items: center; }
.session-event-actor-svg :deep(svg) { width: 100%; height: 100%; }
.session-event-actor-initial { font-family: var(--font-display); font-size: 25px; font-weight: 700; }
.session-event-actor-marker { position: absolute; inset-block-start: 0; inset-inline-end: 0; z-index: 1; }
.session-event-actor-avatar--creature { color: var(--danger); }
.session-event-actor-avatar--dm { grid-template-rows: 27px 12px; align-content: center; }
.session-event-actor-avatar--dm b { font-size: 10px; font-weight: 900; letter-spacing: .1em; line-height: 1; }
</style>
