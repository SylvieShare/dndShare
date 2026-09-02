<template>
  <div
    class="session-event-actor-avatar"
    :class="`session-event-actor-avatar--${kind}`"
    :title="label || fallbackLabel"
    aria-hidden="true"
  >
    <img v-if="imageUrl" :src="imageUrl" alt="" />
    <span v-else-if="actorSvg" class="session-event-actor-svg" v-html="actorSvg" />
    <template v-else-if="kind === 'dm'">
      <Crown :size="16" :stroke-width="1.8" />
      <b>DM</b>
    </template>
    <span v-else-if="initial" class="session-event-actor-initial">{{ initial }}</span>
    <PawPrint v-else-if="kind === 'creature'" :size="17" :stroke-width="1.7" />
    <UserRound v-else :size="17" :stroke-width="1.7" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Crown, PawPrint, UserRound } from '@lucide/vue'
import { pvAvatar } from '@/features/sessions/lib/participantView'
import { sessionEventActorKind } from '@/features/sessions/lib/sessionEventView'

const props = defineProps({
  event: { type: Object, required: true },
  label: { type: String, default: '' },
})

const kind = computed(() => sessionEventActorKind(props.event))
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
.session-event-actor-avatar {
  position: relative;
  width: 34px;
  height: 34px;
  display: grid;
  flex: 0 0 34px;
  overflow: hidden;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-raised) 84%, transparent);
  color: var(--accent-soft);
  box-shadow: 0 5px 15px color-mix(in srgb, var(--bg) 30%, transparent);
}
.session-event-actor-avatar img { width: 100%; height: 100%; display: block; object-fit: cover; }
.session-event-actor-svg { width: 100%; height: 100%; display: grid; place-items: center; padding: 4px; box-sizing: border-box; }
.session-event-actor-svg :deep(svg) { width: 100%; height: 100%; }
.session-event-actor-initial { font-family: var(--font-display); font-size: 16px; font-weight: 700; }
.session-event-actor-avatar--creature { border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); color: color-mix(in srgb, var(--danger) 68%, var(--text-1)); }
.session-event-actor-avatar--dm {
  grid-template-rows: 16px 8px;
  gap: 0;
  border-color: color-mix(in srgb, var(--accent) 64%, var(--border));
  background:
    radial-gradient(circle at 26% 18%, color-mix(in srgb, var(--accent) 38%, transparent), transparent 48%),
    linear-gradient(145deg, color-mix(in srgb, var(--accent) 20%, var(--surface-raised)), color-mix(in srgb, var(--surface) 94%, transparent));
  box-shadow: 0 5px 18px color-mix(in srgb, var(--accent) 18%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--text-on-accent) 6%, transparent);
}
.session-event-actor-avatar--dm b { font-size: 7px; font-weight: 900; letter-spacing: .1em; line-height: 1; }
</style>
