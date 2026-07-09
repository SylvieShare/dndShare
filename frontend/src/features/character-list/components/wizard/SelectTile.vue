<template>
  <div
    class="sel-tile"
    :class="{ 'sel-tile--on': selected }"
    :style="{ '--sel': color }"
    @click="$emit('select')"
  >
    <span v-if="selected" class="sel-strip" />
    <span class="sel-mono">{{ monogram }}</span>
    <div class="sel-body">
      <div class="sel-title">{{ title }}</div>
      <div v-if="subtitle" class="sel-sub">{{ subtitle }}</div>
    </div>
    <svg v-if="selected" class="sel-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" /></svg>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  // First letter / short monogram shown in the medallion.
  monogram: { type: String, default: '' },
  selected: { type: Boolean, default: false },
  // Accent color driving tint, strip and check. Defaults to the app accent.
  color: { type: String, default: 'var(--accent)' },
})
defineEmits(['select'])
</script>

<style scoped>
.sel-tile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  background: var(--block-bg);
  border-radius: var(--r-md);
  padding: 11px 13px;
  cursor: pointer;
  transition: background 0.15s;
  overflow: hidden;
}
.sel-tile:hover {
  background: color-mix(in srgb, var(--sel) 12%, var(--block-bg));
}
.sel-tile--on {
  background: color-mix(in srgb, var(--sel) 16%, var(--block-bg));
}

.sel-strip {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--sel);
}

.sel-mono {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--sel);
  background: color-mix(in srgb, var(--sel) 18%, transparent);
}

.sel-body {
  min-width: 0;
  flex: 1;
}
.sel-title {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sel-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sel-check {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--sel);
}
</style>
