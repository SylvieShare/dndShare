<template>
  <div class="karmic-scale">
    <div class="karmic-scale-heading"><strong>{{ name }}</strong><span>{{ description }}</span></div>
    <div class="karmic-scale-track" role="meter" :aria-label="`Сдвиг вероятности: ${name}`" aria-valuemin="-6" aria-valuemax="6"
      :aria-valuenow="balance" :aria-valuetext="description">
      <span class="karmic-scale-center" aria-hidden="true" />
      <span class="karmic-scale-marker" aria-hidden="true" :style="{ left: `${(balance + 6) / 12 * 100}%` }" />
    </div>
    <div class="karmic-scale-labels"><span>К низким значениям</span><span>К высоким значениям</span></div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ name: String, balance: { type: Number, default: 0 } })
const format = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })
const description = computed(() => props.balance === 0 ? 'Без сдвига'
  : `${props.balance > 0 ? 'К высоким' : 'К низким'} · ${format.format(Math.abs(props.balance))} из 6`)
</script>
<style scoped>
.karmic-scale { display: grid; gap: 8px; min-width: 0; }
.karmic-scale-heading, .karmic-scale-labels { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; font-size: 12px; }
.karmic-scale-heading strong { overflow-wrap: anywhere; }
.karmic-scale-heading span, .karmic-scale-labels { color: var(--text-muted); }
.karmic-scale-track { position: relative; height: 12px; margin-inline: 7px; border-radius: var(--r-sm); background: linear-gradient(to right, color-mix(in srgb, var(--danger) 55%, var(--surface)), var(--surface-raised), color-mix(in srgb, var(--success) 55%, var(--surface))); }
.karmic-scale-center { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--text-muted); }
.karmic-scale-marker { position: absolute; top: -1px; width: 14px; height: 14px; border-radius: 50%; background: var(--text-1); box-shadow: 0 0 0 2px var(--surface); transform: translateX(-50%); transition: left .2s ease; }
@media (prefers-reduced-motion: reduce) { .karmic-scale-marker { transition: none; } }
</style>
