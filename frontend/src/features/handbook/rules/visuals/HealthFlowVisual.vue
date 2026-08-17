<template>
  <div class="health-visual">
    <div class="health-controls">
      <span>Состояние примера</span>
      <MultiToggle v-model="state" :options="states" neutral-value="wounded" aria-label="Состояние здоровья" />
    </div>

    <div class="health-body">
      <BaseTile class="health-sheet" :color="healthColor" framed>
        <header>
          <img src="/static/hp-pulse.svg" alt="" />
          <span><strong>Хиты Лиры</strong><small>{{ healthLabel }}</small></span>
          <span class="health-value">{{ currentHp }} <small>/ 24</small></span>
        </header>
        <div class="health-bar" role="progressbar" aria-label="Текущие хиты" :aria-valuenow="currentHp" aria-valuemin="0" aria-valuemax="24">
          <span :style="{ width: `${currentHp / 24 * 100}%` }" />
        </div>
        <div v-if="state === 'wounded'" class="health-temp"><ShieldPlus aria-hidden="true" /><strong>+3 временных</strong><span>получают урон первыми</span></div>
        <div v-else class="death-saves" aria-label="Спасброски от смерти">
          <div><span>Успехи</span><i v-for="n in 3" :key="`success-${n}`" :class="{ filled: n <= successCount }" /></div>
          <div class="death-fails"><span>Провалы</span><i v-for="n in 3" :key="`fail-${n}`" :class="{ filled: n <= failCount }" /></div>
        </div>
      </BaseTile>

      <div class="health-flow" role="img" aria-label="При положительных хитах персонаж в сознании; при нуле он без сознания и делает спасброски; три успеха стабилизируют, три провала означают смерть">
        <BaseTile class="health-node" color="var(--success)" :tint="state === 'wounded'">
          <HeartPulse aria-hidden="true" /><strong>1+ хитов</strong><span>В сознании</span>
        </BaseTile>
        <ArrowRight aria-hidden="true" />
        <BaseTile class="health-node" color="var(--warning)" :tint="state === 'zero'">
          <Activity aria-hidden="true" /><strong>0 хитов</strong><span>Спасброски</span>
        </BaseTile>
        <div class="health-branches">
          <span><ArrowDownLeft aria-hidden="true" /> 3 успеха</span>
          <span>3 провала <ArrowDownRight aria-hidden="true" /></span>
        </div>
        <BaseTile class="health-node" color="var(--info)" :tint="state === 'stable'">
          <ShieldCheck aria-hidden="true" /><strong>Стабилен</strong><span>Не бросает</span>
        </BaseTile>
        <BaseTile class="health-node" color="var(--danger)">
          <Skull aria-hidden="true" /><strong>Смерть</strong><span>Серия окончена</span>
        </BaseTile>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  Activity,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowRight,
  HeartPulse,
  ShieldCheck,
  ShieldPlus,
  Skull,
} from '@lucide/vue'
import { BaseTile, MultiToggle } from '@sylvieshare/share-ui'

const states = [
  { value: 'wounded', label: 'Есть хиты' },
  { value: 'zero', label: '0 хитов' },
  { value: 'stable', label: 'Стабилен' },
]

const state = ref('wounded')
const currentHp = computed(() => state.value === 'wounded' ? 18 : 0)
const successCount = computed(() => state.value === 'stable' ? 3 : 1)
const failCount = computed(() => state.value === 'zero' ? 1 : 0)
const healthColor = computed(() => state.value === 'wounded' ? 'var(--success)' : state.value === 'stable' ? 'var(--info)' : 'var(--warning)')
const healthLabel = computed(() => state.value === 'wounded' ? 'ранен, но действует' : state.value === 'stable' ? 'без сознания, но вне серии' : 'без сознания')
</script>

<style scoped>
.health-visual { margin: 24px 0 28px; }
.health-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.health-controls > span { color: var(--text-muted); font-size: 9px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
.health-body { display: grid; grid-template-columns: minmax(250px, .75fr) minmax(0, 1.25fr); gap: 12px; }
.health-sheet { min-height: 100%; padding: 17px; }
.health-sheet header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 9px; }
.health-sheet header img { width: 28px; height: 28px; opacity: .8; }
.health-sheet header strong,
.health-sheet header small { display: block; }
.health-sheet header strong { color: var(--text-1); font-family: var(--font-display); font-size: 18px; }
.health-sheet header small { margin-top: 2px; color: var(--text-muted); font-size: 8px; }
.health-value { color: var(--tile-color); font-size: 29px; font-weight: 800; }
.health-value small { display: inline; color: var(--text-muted); font-size: 13px; }
.health-bar { height: 7px; margin: 18px 0; overflow: hidden; border-radius: 999px; background: var(--surface-raised); }
.health-bar span { display: block; height: 100%; border-radius: inherit; background: var(--tile-color); transition: width .25s ease; }
.health-temp { display: grid; grid-template-columns: auto 1fr; gap: 1px 7px; align-items: center; padding: 9px; border-radius: 8px; background: color-mix(in srgb, var(--info) 9%, transparent); }
.health-temp svg { grid-row: 1 / 3; width: 18px; color: var(--info); }
.health-temp strong { color: var(--info); font-size: 11px; }
.health-temp span { color: var(--text-muted); font-size: 8px; }
.death-saves { display: grid; gap: 12px; }
.death-saves > div { display: grid; grid-template-columns: 1fr repeat(3, 16px); align-items: center; gap: 7px; }
.death-saves span { color: var(--text-2); font-size: 9px; text-transform: uppercase; }
.death-saves i { width: 14px; height: 14px; border: 1px solid var(--success); border-radius: 50%; box-sizing: border-box; }
.death-saves i.filled { background: var(--success); box-shadow: inset 0 0 0 3px var(--surface); }
.death-fails i { border-color: var(--danger); }
.death-fails i.filled { background: var(--danger); }
.health-flow { display: grid; grid-template-columns: 1fr 18px 1fr; align-items: center; gap: 8px; }
.health-flow > svg { width: 18px; color: var(--text-muted); }
.health-node { min-height: 84px; display: grid; grid-template-columns: auto 1fr; align-content: center; gap: 2px 8px; padding: 12px; }
.health-node > svg { grid-row: 1 / 3; width: 19px; color: var(--tile-color); }
.health-node strong { color: var(--text-1); font-size: 11px; }
.health-node span { color: var(--text-muted); font-size: 8px; }
.health-branches { grid-column: 2 / 4; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; color: var(--text-muted); font-size: 8px; }
.health-branches span { display: flex; align-items: center; justify-content: space-between; gap: 5px; }
.health-branches svg { width: 16px; }
.health-branches + .health-node { grid-column: 2; }
.health-branches ~ .health-node:last-child { grid-column: 3; }
@media (max-width: 800px) {
  .health-body { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .health-controls { align-items: stretch; flex-direction: column; }
  .health-flow { grid-template-columns: 1fr; }
  .health-flow > svg { justify-self: center; transform: rotate(90deg); }
  .health-branches { grid-column: 1; }
  .health-branches + .health-node,
  .health-branches ~ .health-node:last-child { grid-column: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .health-bar span { transition: none; }
}
</style>
