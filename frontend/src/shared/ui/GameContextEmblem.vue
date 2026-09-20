<template>
  <span class="game-context-emblem" :class="`game-context-emblem--${kind}`" aria-hidden="true">
    <span class="game-context-glyph" :style="{ maskImage: `url(${emblems[kind] || emblems.generic})` }" />
  </span>
</template>

<script setup>
defineProps({ kind: { type: String, default: 'generic' } })

const emblems = {
  dnd: '/static/game-context/dnd-logo.png',
  vampire: '/static/game-context/vampire-ankh.png',
  generic: '/static/game-context/generic.svg',
}
</script>

<style scoped>
.game-context-emblem {
  display: inline-grid;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  place-items: center;
  color: var(--accent);
}

.game-context-glyph {
  width: 36px;
  height: 36px;
  background: currentColor;
  mask-size: contain;
  mask-position: center;
  mask-repeat: no-repeat;
}
</style>
