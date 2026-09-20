<template>
  <span class="game-context-emblem" :class="`game-context-emblem--${kind}`" aria-hidden="true">
    <span class="game-context-glyph" :style="{ maskImage: `url(/static/game-context/${kind}.svg)` }" />
  </span>
</template>

<script setup>
defineProps({ kind: { type: String, default: 'generic' } })
</script>

<style scoped>
.game-context-emblem {
  --emblem-color: var(--text-2);
  display: inline-grid;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  place-items: center;
  border-radius: 10px;
  background: linear-gradient(145deg, color-mix(in srgb, var(--emblem-color) 16%, transparent), color-mix(in srgb, var(--emblem-color) 4%, transparent));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--emblem-color) 22%, transparent);
  color: var(--emblem-color);
}

.game-context-emblem--dnd-classic { --emblem-color: var(--warning); }
.game-context-emblem--dnd-revised { --emblem-color: var(--accent-soft); }
.game-context-emblem--vampire { --emblem-color: var(--danger); }
.game-context-glyph {
  width: 28px;
  height: 28px;
  background: currentColor;
  mask-size: contain;
  mask-position: center;
  mask-repeat: no-repeat;
}
</style>
