<template>
  <div
    class="enc-avatar"
    :class="isPlayer ? 'enc-avatar--player' : 'enc-avatar--npc'"
    :style="{ color: tintColor }"
  >
    <img v-if="imgSrc" class="enc-avatar-img" :class="{ 'enc-avatar-img--photo': isPlayer }" :src="imgSrc" alt="" />
    <span v-else-if="inlineSvg" class="enc-avatar-svg" v-html="inlineSvg" />
    <ImageIcon v-else class="enc-avatar-empty" :size="24" :stroke-width="1.4" aria-hidden="true" />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Image as ImageIcon } from '@lucide/vue'

const props = defineProps({
  combatant: { type: Object, required: true },
})

const enc = inject('encounter')

const isPlayer = computed(() => props.combatant.type === 'player')
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

<style scoped>
.enc-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  background: color-mix(in srgb, currentColor 7%, var(--surface));
}

.enc-avatar--player {
  width: 62px;
  height: 62px;
  border: 1px solid color-mix(in srgb, var(--info) 30%, var(--border));
  border-radius: 14px;
}

.enc-avatar--npc {
  width: 72px;
  height: 72px;
  margin-block: -10px;
  align-self: stretch;
  border-radius: 10px;
}

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
.enc-avatar-svg :deep(svg) { width: 100%; height: 100%; object-fit: contain; }
.enc-avatar-empty { color: currentColor; opacity: 0.5; }
</style>
