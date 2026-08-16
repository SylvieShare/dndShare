<template>
  <button class="sb-album" :class="{ active, 'drop-target': dropTarget }">
    <span class="sb-album-dot" :style="{ background: color || 'var(--text-muted)' }" />
    <span class="sb-album-name">{{ name }}</span>
    <span class="sb-album-count">{{ count }}</span>
  </button>
</template>

<script setup>
defineProps({
  active: { type: Boolean, default: false },
  dropTarget: { type: Boolean, default: false },
  name: { type: String, required: true },
  count: { type: Number, default: 0 },
  color: { type: String, default: '' },
})
</script>

<style scoped>
.sb-album { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid transparent; border-radius: 8px; background: none; color: var(--text-2); font: inherit; font-size: 13px; text-align: left; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
.sb-album:hover { background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); }
.sb-album.active { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--text-on-accent); }
.sb-album.drop-target { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, transparent); }
.sb-album-dot { width: 8px; height: 8px; flex-shrink: 0; border-radius: 50%; }
.sb-album-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-album-count { color: var(--text-muted); font-size: 11px; }
</style>
