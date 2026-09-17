<template>
  <div v-if="bar.max" class="impact-health" :class="{ 'impact-health--loss': bar.lost }">
    <span v-if="bar.lost" class="impact-health-label" :style="{ left: `clamp(45px, ${bar.labelCenter}%, calc(100% - 45px))` }">Урон −{{ bar.lost }}</span>
    <div class="impact-health-track">
      <StatBar label="Здоровье после применения" size="medium" :percent="bar.remaining" :color="color" />
      <span v-if="bar.lost" class="impact-health-loss" :style="{ left: `${bar.lossStart}%`, width: `${bar.lossWidth}%` }" aria-hidden="true" />
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { StatBar } from '@sylvieshare/share-ui'
import { impactBar } from '../lib/impactBar'
const props = defineProps({ impact: { type: Object, required: true } })
const bar = computed(() => impactBar(props.impact))
const color = computed(() => bar.value.remaining > 50 ? 'var(--success)' : bar.value.remaining > 25 ? 'var(--warning)' : 'var(--danger)')
</script>
<style scoped>
.impact-health { min-width: 0; position: relative; }
.impact-health--loss { padding-top: 22px; }
.impact-health-track { position: relative; border-radius: 999px; overflow: hidden; }
.impact-health-label { position: absolute; top: 0; transform: translateX(-50%); color: var(--danger); font-size: 11px; font-weight: 750; white-space: nowrap; }
.impact-health-loss { position: absolute; top: 1px; bottom: 1px; background: color-mix(in srgb, var(--danger) 72%, transparent); border-left: 1px solid var(--danger); box-sizing: border-box; }
</style>
