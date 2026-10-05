<template>
  <div class="karmic-scale">
    <TransferPerson :name="name" :image-url="imageUrl" :size="48">
      <template v-if="fallbackIcon" #avatar><component :is="fallbackIcon" :size="48" class="karmic-scale-icon" aria-hidden="true" /></template>
      <div class="karmic-scale-description">{{ description }}</div>
    <div class="karmic-scale-track" role="meter" :aria-label="`Сдвиг вероятности: ${name}`" aria-valuemin="-6" aria-valuemax="6"
      :aria-valuenow="balance" :aria-valuetext="description">
      <span class="karmic-scale-center" aria-hidden="true" />
      <span class="karmic-scale-marker" aria-hidden="true" :style="{ left: `${(balance + 6) / 12 * 100}%` }" />
    </div>
      <div class="karmic-scale-labels"><span>К низким значениям</span><span>К высоким значениям</span></div>
    </TransferPerson>
    <KarmicDiceDistribution :name="name" :probabilities="probabilities" />
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { Crown, PawPrint, UsersRound } from '@lucide/vue'
import TransferPerson from '@/features/item-transfers/components/TransferPerson.vue'
import KarmicDiceDistribution from './KarmicDiceDistribution.vue'
const props = defineProps({ name: String, imageUrl: String, actorKey: { type: String, default: '' }, probabilities: { type: Array, default: () => Array(20).fill(.05) }, balance: { type: Number, default: 0 } })
const fallbackIcon = computed(() => props.imageUrl ? null : props.actorKey === 'shared' ? UsersRound : props.actorKey.startsWith('dm:') ? Crown : props.actorKey.startsWith('npc:') ? PawPrint : null)
const format = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })
const description = computed(() => props.balance === 0 ? 'Без сдвига'
  : `${props.balance > 0 ? 'К высоким' : 'К низким'} · ${format.format(Math.abs(props.balance))} из 6`)
</script>
<style scoped>
.karmic-scale { display: grid; gap: 15px; min-width: 0; }
.karmic-scale-icon { flex: none; color: var(--accent-soft); }
.karmic-scale-description { margin: 4px 0 10px; color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.karmic-scale-labels { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; margin-top: 7px; color: var(--text-muted); font-size: 11px; }
.karmic-scale-track { position: relative; height: 12px; margin-inline: 7px; border-radius: var(--r-sm); background: linear-gradient(to right, color-mix(in srgb, var(--danger) 55%, var(--surface)), var(--surface-raised), color-mix(in srgb, var(--success) 55%, var(--surface))); }
.karmic-scale-center { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--text-muted); }
.karmic-scale-marker { position: absolute; top: -1px; width: 14px; height: 14px; border-radius: 50%; background: var(--text-1); box-shadow: 0 0 0 2px var(--surface); transform: translateX(-50%); transition: left .2s ease; }
@media (prefers-reduced-motion: reduce) { .karmic-scale-marker { transition: none; } }
</style>
