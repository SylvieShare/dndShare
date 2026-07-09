<template>
  <div
    class="enc-avatar"
    :class="{ 'enc-avatar--player': isPlayer }"
    :style="{ color: tintColor }"
  >
    <img v-if="imgSrc" class="enc-avatar-img" :class="{ 'enc-avatar-img--photo': isPlayer }" :src="imgSrc" />
    <span v-else-if="inlineSvg" class="enc-avatar-svg" v-html="inlineSvg" />
    <span v-else class="enc-avatar-letter">{{ letter }}</span>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const props = defineProps({
  combatant: { type: Object, required: true },
})

const enc = inject('encounter')

const isPlayer = computed(() => props.combatant.type === 'player')
const isNpc    = computed(() => props.combatant.type === 'npc')

const playerAva = computed(() => isPlayer.value ? enc.getPlayerAva(props.combatant.charId) : null)

// The bestiary item's `svg` field holds the creature artwork — an uploaded image
// (URL) or inline <svg> markup. Resolve it for NPCs.
const npcArt = computed(() => isNpc.value ? (enc.npcItem(props.combatant)?.svg || '') : '')
const npcArtIsUrl = computed(() => /^(https?:|\/|data:image)/.test(npcArt.value))

const imgSrc = computed(() => {
  if (playerAva.value) return playerAva.value
  if (isNpc.value && npcArtIsUrl.value) return npcArt.value
  return null
})

const inlineSvg = computed(() =>
  isNpc.value && npcArt.value && !npcArtIsUrl.value ? npcArt.value : ''
)

const letter = computed(() => {
  const name = isPlayer.value ? enc.playerDisplayName(props.combatant) : (enc.npcName(props.combatant) || '?')
  return (name[0] || '?').toUpperCase()
})

const tintColor = computed(() => enc.avatarStyle(props.combatant)?.color || 'var(--text-2)')
</script>

<style scoped>
.enc-avatar {
  width: 44px;
  height: 48px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  background: none;
  border: none;
}

.enc-avatar--player {
  width: 48px;
}

.enc-avatar-letter {
  font-size: 18px;
  font-weight: 700;
  color: currentColor;
  align-self: center;
}

/* Creature / portrait art — pinned to the bottom edge so a standing figure keeps its feet planted. */
.enc-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: bottom center;
}

/* Player photos crop to fill (face stays near the top). */
.enc-avatar-img--photo {
  object-fit: cover;
  object-position: center 15%;
}

.enc-avatar-svg {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: currentColor;
}
.enc-avatar-svg :deep(svg) { width: 36px; height: 44px; object-fit: contain; }
</style>
