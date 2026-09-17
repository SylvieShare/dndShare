<template>
  <div class="hp-row">
    <StatBar label="Здоровье" class="p-hp-statbar" :size="size" :decorated="size === 'medium'"
      :percent="hpPercent" :color="hpColor" :temp-percent="tempPercent" />
    <div class="hp-numbers">
      <span class="hp-current" :style="{ color: hpColor }">{{ hp.current }}</span>
      <span v-if="hp.temp" class="hp-temp">+{{ hp.temp }}</span>
      <span class="hp-sep">/</span>
      <span class="hp-max">{{ hp.max }}</span>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { StatBar } from '@sylvieshare/share-ui'
const props = defineProps({ size: { type: String, default: 'small' }, hp: { type: Object, required: true } })
const hpPercent = computed(() => {
  if (!props.hp.max) return 0
  return Math.min(100, Math.max(0, (props.hp.current / props.hp.max) * 100))
})
const tempPercent = computed(() => {
  if (!props.hp.max || !props.hp.temp) return 0
  return Math.min(100 - hpPercent.value, (props.hp.temp / props.hp.max) * 100)
})
const hpColor = computed(() => {
  if (hpPercent.value > 50) return 'var(--success)'
  if (hpPercent.value > 25) return 'var(--warning)'
  return 'var(--danger)'
})
</script>
<style scoped>
.hp-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 5px;
}

.p-hp-statbar { flex: 1; }

.hp-numbers {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-size: 10px;
  font-weight: 400;
  flex-shrink: 0;
}

.hp-current {
  font-weight: 700;
  font-size: 11px;
}

.hp-temp {
  color: var(--info);
  font-size: 10px;
}

.hp-sep {
  color: var(--text-muted);
  margin: 0 1px;
}

.hp-max {
  color: var(--text-muted);
}
</style>
