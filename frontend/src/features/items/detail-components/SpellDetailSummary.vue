<template>
  <div class="spell-summary">
    <div class="spell-summary-grid">
      <div v-if="data.time" class="spell-summary-card">
        <span><Clock3 :size="14" aria-hidden="true" /> Время</span>
        <strong>{{ data.time }}</strong>
      </div>
      <div v-if="data.range" class="spell-summary-card">
        <span><LocateFixed :size="14" aria-hidden="true" /> Дистанция</span>
        <strong>{{ data.range }}</strong>
      </div>
      <div v-if="data.duration" class="spell-summary-card">
        <span><Hourglass :size="14" aria-hidden="true" /> Длительность</span>
        <strong>{{ data.duration }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Clock3, Hourglass, LocateFixed } from '@lucide/vue'

const props = defineProps({ item: { type: Object, required: true } })
const data = computed(() => props.item.data || {})
</script>

<style scoped>
.spell-summary {
  flex: 1;
  min-height: min-content;
  display: flex;
  align-items: flex-end;
  width: 100%;
}

.spell-summary-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.spell-summary-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 18%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 76%, transparent);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--scrim) 50%, transparent);
  backdrop-filter: blur(7px);
}

.spell-summary-card > span {
  display: flex;
  align-items: center;
  gap: 5px;
  color: color-mix(in srgb, var(--accent-soft) 76%, var(--text-on-accent));
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.spell-summary-card strong {
  color: var(--text-on-accent);
  font-size: 17px;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

@media (max-width: 520px) {
  .spell-summary-grid { gap: 7px; }
  .spell-summary-card { gap: 4px; padding: 9px 8px; }
  .spell-summary-card > span { font-size: 8px; letter-spacing: .06em; }
  .spell-summary-card strong { font-size: 13px; }
}
</style>
