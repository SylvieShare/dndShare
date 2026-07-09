<template>
  <nav class="rail">
    <button
      v-for="(s, i) in steps"
      :key="s.key"
      class="rail-step"
      :class="{ active: i === current, done: i < current }"
      :disabled="i > current"
      @click="$emit('go', i)"
    >
      <span class="rail-strip" />
      <span class="rail-badge">
        <svg v-if="i < current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" /></svg>
        <template v-else>{{ i + 1 }}</template>
      </span>
      <span class="rail-title">{{ s.title }}</span>
    </button>
  </nav>
</template>

<script setup>
defineProps({
  steps: { type: Array, required: true },
  current: { type: Number, default: 0 },
})
defineEmits(['go'])
</script>

<style scoped>
.rail { display: flex; flex-direction: column; gap: 2px; }
.rail-step {
  position: relative;
  display: flex; align-items: center; gap: 11px;
  background: none; border: none; text-align: left;
  padding: 10px 12px; border-radius: 9px; cursor: pointer;
  transition: background 0.15s;
}
.rail-step:disabled { cursor: default; }
.rail-step:not(:disabled):hover { background: color-mix(in srgb, #fff 4%, transparent); }
.rail-step.active { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.rail-strip { position: absolute; top: 9px; bottom: 9px; left: 0; width: 3px; border-radius: 0 2px 2px 0; background: var(--accent); opacity: 0; }
.rail-step.active .rail-strip { opacity: 1; }

.rail-badge {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;
  color: var(--text-muted); box-shadow: inset 0 0 0 1px var(--border-strong);
}
.rail-badge svg { width: 13px; height: 13px; }
.rail-step.active .rail-badge { background: var(--accent); color: #fff; box-shadow: none; }
.rail-step.done .rail-badge { background: color-mix(in srgb, var(--accent) 30%, transparent); color: #c4a0ff; box-shadow: none; }

.rail-title { font-size: 13px; color: var(--text-2); }
.rail-step.active .rail-title { color: var(--text-1); font-weight: 500; }
</style>
