<template>
  <div class="rps-result" :class="{ 'rps-result--compact': compact }" :aria-label="summary">
    <div class="rps-contestants">
      <template v-for="(player, index) in players" :key="player.uuid">
        <span v-if="index" class="rps-versus" aria-hidden="true">VS</span>
        <BaseTile class="rps-contestant" :class="{ 'rps-contestant--winner': player.winner }" :tint="player.winner" :framed="player.winner" color="var(--success)">
          <SessionEventActorAvatar class="rps-avatar" :event="player.event" :label="player.name" />
          <strong class="rps-name">{{ player.name }}</strong>
          <RpsChoiceIcon :choice="player.choice" :size="compact ? 32 : 64" />
          <span class="rps-choice-label">{{ choiceLabel(player.choice) }}</span>
          <span v-if="player.winner" class="rps-winner">Победитель</span>
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
.rps-contestants { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: stretch; gap: 12px; }
.rps-contestant { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px 12px; min-width: 0; text-align: center; color: var(--text-1); }
.rps-contestant--winner { color: var(--success); }
.rps-name { overflow-wrap: anywhere; font-size: 15px; }
.rps-choice-label { font-size: 12px; color: var(--text-muted); }
.rps-winner { font-size: 12px; font-weight: 700; }
.rps-versus { align-self: center; color: var(--text-muted); font-size: 13px; font-weight: 800; letter-spacing: .08em; }
.rps-draw { margin: 12px 0 0; text-align: center; color: var(--text-2); font-weight: 650; }
.rps-result--compact .rps-contestants { gap: 6px; }
.rps-result--compact .rps-contestant { padding: 10px 6px; gap: 5px; }
.rps-result--compact .rps-avatar { width: 32px; height: 32px; flex-basis: 32px; }
.rps-result--compact .rps-name, .rps-result--compact .rps-winner, .rps-result--compact .rps-choice-label { font-size: 11px; }
.rps-result--compact .rps-versus { font-size: 10px; }
</style>
