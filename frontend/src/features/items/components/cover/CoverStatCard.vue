<template>
  <div class="cover-stat-card" :class="[`cover-stat-card-${tone}`, `cover-stat-card-${size}`]">
    <div class="cover-stat-card-body">
      <div class="cover-stat-card-label">{{ label }}</div>
      <div class="cover-stat-card-value">
        <slot name="value">{{ value }}</slot>
      </div>
      <div v-if="$slots.note || note" class="cover-stat-card-note">
        <slot name="note">{{ note }}</slot>
      </div>
    </div>
    <component
      :is="icon"
      v-if="icon"
      class="cover-stat-card-mark"
      aria-hidden="true"
    />
  </div>
</template>

<script setup>
defineProps({
  icon: { type: [Object, Function], default: null },
  label: { type: String, required: true },
  value: { type: [String, Number], default: '' },
  note: { type: [String, Number], default: '' },
  tone: {
    type: String,
    default: 'neutral',
    validator: value => ['neutral', 'accent', 'danger', 'warning'].includes(value),
  },
  size: {
    type: String,
    default: 'large',
    validator: value => ['large', 'medium', 'compact'].includes(value),
  },
})
</script>

<style scoped>
.cover-stat-card {
  --cover-stat-tone: var(--text-on-accent);
  position: relative;
  min-width: 0;
  padding: 10px 12px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 18%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 74%, transparent);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--scrim) 42%, transparent);
  backdrop-filter: blur(6px);
  box-sizing: border-box;
}

.cover-stat-card-accent {
  --cover-stat-tone: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 46%, transparent);
  background: color-mix(in srgb, var(--accent) 15%, var(--surface) 62%);
}

.cover-stat-card-danger {
  --cover-stat-tone: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 48%, transparent);
  background: color-mix(in srgb, var(--danger) 16%, var(--surface) 61%);
}

.cover-stat-card-warning {
  --cover-stat-tone: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 44%, transparent);
  background: color-mix(in srgb, var(--warning) 13%, var(--surface) 64%);
}

.cover-stat-card-body {
  min-width: 0;
  padding-right: 34px;
}

.cover-stat-card-label {
  overflow: hidden;
  color: color-mix(in srgb, var(--cover-stat-tone) 70%, var(--text-on-accent));
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .09em;
  line-height: 1.2;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.cover-stat-card-value {
  margin-top: 4px;
  overflow: hidden;
  color: var(--text-on-accent);
  font-size: 27px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1.05;
  overflow-wrap: anywhere;
  text-overflow: ellipsis;
  text-shadow: 0 1px 8px var(--scrim);
}

.cover-stat-card-medium .cover-stat-card-value {
  font-size: 20px;
  line-height: 1.1;
}

.cover-stat-card-compact .cover-stat-card-value {
  font-size: 17px;
  line-height: 1.15;
}

.cover-stat-card-note {
  margin-top: 2px;
  overflow: hidden;
  color: color-mix(in srgb, var(--text-on-accent) 58%, transparent);
  font-size: 10px;
  line-height: 1.3;
  text-overflow: ellipsis;
}

.cover-stat-card-mark {
  position: absolute;
  top: 50%;
  right: 12px;
  width: 27px;
  height: 27px;
  color: color-mix(in srgb, var(--cover-stat-tone) 72%, var(--text-on-accent));
  filter: drop-shadow(0 2px 8px color-mix(in srgb, var(--scrim) 64%, transparent));
  opacity: .46;
  pointer-events: none;
  transform: translateY(-50%);
}

@media (max-width: 520px) {
  .cover-stat-card { padding: 9px 10px; }
  .cover-stat-card-body { padding-right: 28px; }
  .cover-stat-card-mark { right: 9px; width: 23px; height: 23px; }
  .cover-stat-card-large .cover-stat-card-value { font-size: 24px; }
  .cover-stat-card-medium .cover-stat-card-value { font-size: 17px; }
  .cover-stat-card-compact .cover-stat-card-value { font-size: 14px; }
  .cover-stat-card-label { font-size: 8px; letter-spacing: .06em; }
}
</style>
