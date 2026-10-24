<template>
  <SessionCreatureAvatar class="enc-avatar" :class="isPlayer ? 'enc-avatar--player' : 'enc-avatar--npc'" :url="imgSrc" :svg="inlineSvg" :icon="!isPlayer || isPlayerIcon" :color="tintColor" />
</template>

<script setup>
import { computed, inject } from 'vue'
import SessionCreatureAvatar from './SessionCreatureAvatar.vue'

const props = defineProps({
  combatant: { type: Object, required: true },
})

const enc = inject('encounter', null) || inject('applicationEncounter', null)

const isPlayer = computed(() => props.combatant.type === 'player')
const isPlayerIcon = computed(() => isPlayer.value && !!enc.findParticipant(props.combatant.charId)?.iconImageUrl)
const isNpc    = computed(() => props.combatant.type === 'npc')

const playerAva = computed(() => isPlayer.value ? enc.getPlayerAva(props.combatant.charId) : null)

// Raster creature artwork is projected from item.icon_image_id; an assigned
// SVG remains the secondary supported icon format.
const npcArt = computed(() => {
  if (!isNpc.value) return ''
  const item = enc.npcItem(props.combatant)
  return item?.iconImageUrl || item?.svg || ''
})
const npcArtIsUrl = computed(() => /^(https?:|\/|data:image)/.test(npcArt.value))

const imgSrc = computed(() => {
  if (playerAva.value) return playerAva.value
  if (isNpc.value && npcArtIsUrl.value) return npcArt.value
  return null
})

const inlineSvg = computed(() =>
  isNpc.value && npcArt.value && !npcArtIsUrl.value ? npcArt.value : ''
)

const tintColor = computed(() => enc.avatarStyle(props.combatant)?.color || 'var(--text-2)')
</script>
