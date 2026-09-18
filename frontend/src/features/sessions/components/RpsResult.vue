<template>
  <div class="rps-result" :class="{ 'rps-result--compact': compact }" role="group" :aria-label="summary">
    <div class="rps-contestants">
      <template v-for="(player, index) in players" :key="player.uuid">
        <span v-if="index" class="rps-versus" aria-hidden="true">VS</span>
        <BaseTile class="rps-contestant" :class="{ 'rps-contestant--winner': player.winner }" :tint="player.winner" :framed="player.winner" color="var(--success)">
          <SessionEventActorAvatar class="rps-avatar" :event="player.event" :label="player.name" />
          <span class="rps-player-copy" :title="`${player.name}${player.winner ? ' — победитель' : ''}`">
            <strong class="rps-name">{{ player.name }}</strong>
            <span class="rps-choice-label">{{ choiceLabel(player.choice) }}</span>
          </span>
          <RpsChoiceIcon class="rps-choice-icon" :choice="player.choice" :size="compact ? 24 : 36" />
        </BaseTile>
      </template>
    </div>
    <p v-if="!event.data.winnerCharUuid" class="rps-draw">Ничья</p>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import SessionEventActorAvatar from './SessionEventActorAvatar.vue'
import RpsChoiceIcon from './RpsChoiceIcon.vue'
import { interactionDetails, RPS_CHOICES } from '../lib/sessionInteractions'
const props = defineProps({ event: { type: Object, required: true }, compact: Boolean })
const choiceLabel = value => RPS_CHOICES.find(choice => choice.value === value)?.label || ''
const summary = computed(() => interactionDetails(props.event))
const players = computed(() => {
  const data = props.event.data
  return [
    { uuid: data.senderCharUuid, name: data.senderName, choice: data.senderChoice, event: props.event },
    { uuid: data.recipientCharUuid, name: data.recipientName, choice: data.recipientChoice,
      event: { actorCharUuid: data.recipientCharUuid, actorImageUrl: props.event.recipientImageUrl } },
  ].map(player => ({ ...player, winner: !!data.winnerCharUuid && player.uuid === data.winnerCharUuid }))
})
</script>
<style scoped>
.rps-result { min-width: 0; width: 100%; }
.rps-contestants { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: stretch; gap: 8px; }
.rps-contestant { display: grid; grid-template-columns: 32px minmax(0, 1fr) 36px; grid-template-areas: "avatar copy choice"; align-items: center; gap: 8px; padding: 10px; min-width: 0; color: var(--text-1); }
.rps-contestant:last-child { grid-template-columns: 36px minmax(0, 1fr) 32px; grid-template-areas: "choice copy avatar"; text-align: right; }
.rps-avatar { grid-area: avatar; width: 32px; height: 32px; flex-basis: 32px; }
.rps-player-copy { grid-area: copy; display: grid; gap: 2px; min-width: 0; }
.rps-choice-icon { grid-area: choice; }
.rps-contestant--winner { color: var(--success); }
.rps-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.rps-choice-label { color: var(--text-muted); font-size: 11px; }
.rps-versus { align-self: center; color: var(--text-muted); font-size: 11px; font-weight: 800; }
.rps-draw { margin: 6px 0 0; text-align: center; color: var(--text-2); font-size: 12px; }
.rps-result--compact .rps-contestants { gap: 4px; }
.rps-result--compact .rps-contestant { grid-template-columns: 24px minmax(0, 1fr) 24px; padding: 6px; gap: 4px; }
.rps-result--compact .rps-avatar { width: 24px; height: 24px; flex-basis: 24px; }
.rps-result--compact .rps-name { font-size: 11px; }
.rps-result--compact .rps-choice-label, .rps-result--compact .rps-versus { font-size: 10px; }
@media (max-width: 400px) {
  .rps-contestant, .rps-contestant:last-child { grid-template-columns: 24px minmax(0, 1fr) 24px; padding: 6px; gap: 4px; }
  .rps-avatar, .rps-choice-icon { width: 24px; height: 24px; }
}
</style>
