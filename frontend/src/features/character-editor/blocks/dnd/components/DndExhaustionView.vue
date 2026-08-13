<template>
  <!-- Shared exhaustion face, rendered in the tile and in the morph #view so they never drift.
       Padding/strip are owned by the wrapper (BaseTile / morph face); this is just the content. -->
  <div class="exh-view">
    <div class="exh-head">
      <span class="sheet-tile-title exh-label">{{ level > 0 ? 'Истощение' : 'Истощения нет' }}</span>
      <span class="exh-pencil" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </span>
      <span v-if="level > 0" class="exh-value exh-value--on">{{ valueText }}</span>
    </div>
    <ul v-if="level > 0" class="exh-lines">
      <li v-for="(eff, i) in activeEffects" :key="i">{{ eff }}</li>
    </ul>
  </div>
</template>

<script setup>
defineProps({
  level: { type: Number, default: 0 },
  valueText: { type: String, default: '' },
  activeEffects: { type: Array, default: () => [] },
})
</script>

<style scoped>
.exh-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.exh-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.exh-pencil {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0.35;
  transition: opacity 0.15s;
}
@media (hover: hover) { .exh-view:hover .exh-pencil { opacity: 1; } }
.exh-label {
  white-space: nowrap;
}
.exh-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
}
.exh-value--on { color: var(--danger); }

.exh-lines {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.exh-lines li {
  position: relative;
  padding-left: 12px;
  font-size: 12px;
  line-height: 1.35;
  color: var(--text-2);
}
.exh-lines li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--danger);
}
</style>
