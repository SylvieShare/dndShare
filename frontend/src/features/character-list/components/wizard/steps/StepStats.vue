<template>
  <div class="step">
    <div class="stats-bar">
      <MultiToggle :options="methodOptions" :model-value="state.statMethod" @update:model-value="changeMethod" />
      <button v-if="state.statMethod === 'array'" type="button" class="qb" title="Раскидать стандартный набор по классу" @click="quickBuild">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h7l-1 8 10-12h-7z" /></svg>
        Быстрая сборка
      </button>
      <button v-else-if="state.statMethod === 'roll'" type="button" class="roll-btn" @click="requestRoll">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /><circle cx="16" cy="16" r="1.4" fill="currentColor" /><circle cx="16" cy="8" r="1.4" fill="currentColor" /><circle cx="8" cy="16" r="1.4" fill="currentColor" /></svg>
        {{ state.rollPool.length ? 'Перебросить 4d6 ×6' : 'Бросить 4d6 ×6' }}
      </button>
      <span v-if="state.statMethod === 'pointbuy'" class="budget" :class="{ over: pointsLeft < 0 }">Осталось <b>{{ pointsLeft }}</b> / {{ BUDGET }}</span>
    </div>

    <p class="hint">{{ hint }}</p>

    <div v-if="state.statMethod === 'roll' && state.rollSeries.length" class="roll-series" aria-label="Результаты бросков характеристик">
      <div
        v-for="(series, seriesIndex) in state.rollSeries"
        :key="seriesIndex"
        class="roll-series-item"
        :class="{ rolling: seriesRolling(seriesIndex) }"
      >
        <strong>{{ displayedSeriesTotal(seriesIndex, series.total) }}</strong>
        <span class="roll-dice">
          <span
            v-for="(die, dieIndex) in series.dice"
            :key="die.id"
            :class="{ dropped: die.dropped && !seriesRolling(seriesIndex), rolling: seriesRolling(seriesIndex) }"
            :style="{ '--die-index': dieIndex }"
            :title="die.dropped ? 'Младший результат не учитывается' : `${die.value}`"
          >
            <SystemDie
              :sides="6"
              :value="displayedDieValue(seriesIndex, dieIndex, die.value)"
              :size="32"
            />
          </span>
        </span>
      </div>
    </div>

    <div class="grid">
      <div v-for="s in STATS" :key="s" class="stat" :class="{ primary: primaryAbilities.includes(s) }">
        <div class="stat-head">
          <span class="stat-identity">
            <span class="stat-symbol" :style="{ '--stat-color': suggestFor(s)?.color || 'var(--accent)' }">
              <SvgIcon
                v-if="suggestFor(s)?.svg"
                class="stat-icon"
                :svg="suggestFor(s).svg"
                :color="suggestFor(s).color || 'var(--accent)'"
              />
              <span v-else class="stat-code">{{ s }}</span>
            </span>
            <span class="stat-name">{{ STAT_FULL[s] }}</span>
          </span>
          <span v-if="primaryAbilities.includes(s)" class="primary-badge">
            <svg class="star" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3L22 9.3l-5 5 1.2 7L12 17.8 5.8 21.3 7 14.3l-5-5 7.1-1z" /></svg>
            Ключевая
          </span>
        </div>

        <div class="stat-score-row">
          <span class="stat-score">
            <small>Итог</small>
            <strong v-if="assigned(s)">{{ finalScores[s] }}</strong>
            <strong v-else class="stat-placeholder">?</strong>
          </span>
          <span class="stat-mod" :class="assigned(s) ? modClass(mods[s]) : ''">
            <small>Модификатор</small>
            <strong>{{ assigned(s) ? formatMod(mods[s]) : '—' }}</strong>
          </span>
        </div>

        <div class="stat-breakdown">
          <span>База <strong :class="{ 'base-placeholder': !assigned(s) }">{{ assigned(s) ? state.scores[s] : '?' }}</strong></span>
          <span v-if="asiFor(s)" class="stat-asi">Раса <strong>+{{ asiFor(s) }}</strong></span>
          <span v-else class="stat-no-asi">Без бонуса расы</span>
        </div>

        <div class="stat-ctl">
          <template v-if="state.statMethod === 'pointbuy'">
            <span class="ctl-label">Базовое значение</span>
            <span class="stat-stepper">
              <button class="step-btn" :disabled="(state.scores[s] ?? 8) <= 8" :aria-label="`Уменьшить ${STAT_FULL[s]}`" @click="bump(s, -1)">−</button>
              <span class="step-val">{{ state.scores[s] ?? 8 }}</span>
              <button class="step-btn" :disabled="(state.scores[s] ?? 8) >= 15 || pointsLeft < costStep(s)" :aria-label="`Увеличить ${STAT_FULL[s]}`" @click="bump(s, 1)">+</button>
            </span>
            <small v-if="(state.scores[s] ?? 8) < 15" class="step-cost">Следующий шаг: {{ costStep(s) }} очк.</small>
            <small v-else class="step-cost">Достигнут максимум</small>
          </template>
          <div v-else class="pool-field">
            <ValueSelect
              class="pool-picker"
              :model-value="state.scores[s] ?? null"
              :options="poolOptions(s)"
              placeholder="Выберите значение"
              :aria-label="`Назначить значение характеристики ${STAT_FULL[s]}`"
              @update:model-value="assign(s, $event)"
            />
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-if="rerollConfirmOpen"
      title="Перебросить результаты?"
      message="Судьба уже высказалась. Просить её повторить бросок — поведение, недостойное настоящего героя. Всё равно продолжить?"
      confirm-label="Да, мне не стыдно"
      @cancel="rerollConfirmOpen = false"
      @confirm="confirmReroll"
    />
  </div>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { ConfirmDialog, MultiToggle, ValueSelect } from '@sylvieshare/share-ui'
import SystemDie from '@/shared/ui/SystemDie.vue'
import SvgIcon from '@/shared/ui/SvgIcon.vue'
import { POINT_BUY_BUDGET, STANDARD_ARRAY, pointCost } from '@/features/character-list/composables/useDndCreateWizard'
import { STAT_FULL, SUGGEST16_TO_STAT, formatMod } from '@/features/character-list/components/wizard/labels'
import { useDiceRollAnimation } from '@/shared/composables/useDiceRollAnimation'
import { useSuggestStore } from '@/stores/suggest'

const { STATS, state, grants, finalScores, mods, pointsLeft, primaryAbilities, setMethod, rollStats, quickBuild } = inject('createWizard')

const BUDGET = POINT_BUY_BUDGET
const methodOptions = [
  { value: 'array', label: 'Стандартный' },
  { value: 'pointbuy', label: 'Покупка' },
  { value: 'roll', label: 'Бросок' },
]
const hint = computed(() => ({
  array: 'Стандартный набор 15 · 14 · 13 · 12 · 10 · 8 — раскидай по характеристикам.',
  pointbuy: 'Покупка за 27 очков, каждая характеристика 8–15.',
  roll: 'Брось 4d6 со сбросом младшего ×6 и распредели результаты.',
}[state.statMethod] || ''))

const pool = computed(() => (state.statMethod === 'roll' ? state.rollPool : STANDARD_ARRAY))
const rerollConfirmOpen = ref(false)
const rollAnimationEntries = ref([])
let rollAnimationSequence = 0
const suggestStore = useSuggestStore()
const statSuggestByKey = computed(() => Object.fromEntries(
  suggestStore.items(16)
    .map(item => [SUGGEST16_TO_STAT[Number(item.id)], item])
    .filter(([stat]) => stat),
))

function assigned(s) { return state.scores[s] != null }
function suggestFor(s) { return statSuggestByKey.value[s] || null }
function asiFor(s) { return (grants.value.asi || []).filter((a) => a.stat === s).reduce((sum, a) => sum + a.bonus, 0) }
function modClass(m) { return m > 0 ? 'pos' : m < 0 ? 'neg' : '' }

function availablePool(stat) {
  const used = new Map()
  for (const key of STATS) {
    if (key === stat || state.scores[key] == null) continue
    const value = Number(state.scores[key])
    used.set(value, (used.get(value) || 0) + 1)
  }
  const available = []
  for (const raw of pool.value) {
    const value = Number(raw)
    const count = used.get(value) || 0
    if (count > 0) used.set(value, count - 1)
    else available.push(value)
  }
  const current = state.scores[stat]
  if (current != null && !available.some(value => value === Number(current))) available.unshift(Number(current))
  return available
}
function poolOptions(stat) {
  const counts = new Map()
  for (const value of availablePool(stat)) counts.set(value, (counts.get(value) || 0) + 1)
  return [
    { value: '', label: 'Не назначено', key: `${stat}-empty` },
    ...Array.from(counts, ([value, count]) => ({
      value,
      label: count > 1 ? `${value} · доступно ×${count}` : String(value),
      key: `${stat}-${value}`,
    })),
  ]
}
function assign(stat, raw) { state.scores[stat] = raw === '' ? null : Number(raw) }
function costStep(stat) {
  const cur = state.scores[stat] ?? 8
  return pointCost(Math.min(cur + 1, 15)) - pointCost(cur)
}
function bump(stat, dir) {
  const cur = state.scores[stat] ?? 8
  state.scores[stat] = Math.max(8, Math.min(15, cur + dir))
}
function shouldAnimateDice() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
const {
  displayedRoll,
  displayedTotal,
  startEntryAnimation,
  isRolling,
  dispose: disposeRollAnimation,
} = useDiceRollAnimation({ shouldAnimate: shouldAnimateDice })
function rollEntry(seriesIndex) { return rollAnimationEntries.value[seriesIndex] || null }
function seriesRolling(seriesIndex) {
  const entry = rollEntry(seriesIndex)
  return entry ? isRolling(entry.id) : false
}
function displayedDieValue(seriesIndex, dieIndex, actual) {
  const entry = rollEntry(seriesIndex)
  return entry ? displayedRoll(entry, 0, dieIndex, actual) : actual
}
function displayedSeriesTotal(seriesIndex, actual) {
  const entry = rollEntry(seriesIndex)
  return entry ? displayedTotal(entry) : actual
}
function animateRoll() {
  disposeRollAnimation()
  rollStats()
  rollAnimationSequence += 1
  rollAnimationEntries.value = state.rollSeries.map((series, seriesIndex) => ({
    id: `wizard-stats-${rollAnimationSequence}-${seriesIndex}`,
    result: {
      parts: [{
        sign: '+', operator: '+', kind: 'dice', sides: 6,
        rolls: series.dice.map(die => die.value),
        dropped: series.dice.flatMap((die, index) => die.dropped ? [index] : []),
      }],
      total: series.total,
    },
  }))
  rollAnimationEntries.value.forEach(startEntryAnimation)
}
function changeMethod(method) {
  disposeRollAnimation()
  rollAnimationEntries.value = []
  setMethod(method)
}
function requestRoll() {
  if (state.rollPool.length) rerollConfirmOpen.value = true
  else animateRoll()
}
function confirmReroll() {
  rerollConfirmOpen.value = false
  animateRoll()
}
onBeforeUnmount(disposeRollAnimation)
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 14px; }
.stats-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.qb { display: inline-flex; align-items: center; gap: 6px;
  background: color-mix(in srgb, var(--accent) 12%, var(--surface-raised)); border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border-strong)); border-radius: 8px; color: var(--accent);
  font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; padding: 7px 10px;
}
.qb svg { width: 15px; height: 15px; flex: 0 0 auto; }
.qb:hover { color: var(--text-1); border-color: var(--accent); }
.budget { font-size: 13px; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--surface-raised)); border-radius: 8px; padding: 7px 10px; margin-left: auto; font-variant-numeric: tabular-nums; }
.budget b { font-size: 18px; line-height: 0; }
.budget.over { color: var(--danger); }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.roll-btn { display: inline-flex; align-items: center; gap: 8px;
  background: var(--accent); color: var(--text-on-accent); border: none; border-radius: 9px;
  min-height: 34px; padding: 7px 12px; font: inherit; font-size: 12px; font-weight: 750; cursor: pointer;
}
.roll-btn svg { width: 17px; height: 17px; }
.roll-series { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; width: 100%; }
.roll-series-item { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 9px 11px; border: 1px solid color-mix(in srgb, var(--border) 72%, transparent); border-radius: 10px; background: var(--surface); transition: border-color .18s ease, box-shadow .18s ease; }
.roll-series-item.rolling { border-color: color-mix(in srgb, var(--accent) 50%, var(--border)); box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 10%, transparent); }
.roll-series-item > strong { min-width: 27px; color: var(--text-1); font-size: 19px; font-variant-numeric: tabular-nums; text-align: center; }
.roll-series-item.rolling > strong { color: var(--accent); }
.roll-dice { display: flex; align-items: center; gap: 3px; }
.roll-dice > span { position: relative; display: inline-flex; }
.roll-dice .dropped { opacity: .36; filter: grayscale(1); }
.roll-dice .dropped::after { position: absolute; left: 1px; right: 1px; top: 50%; height: 1px; background: var(--danger); content: ''; transform: rotate(-25deg); }
.roll-dice > span.rolling { transform-origin: center; animation: stats-die-tumble .56s cubic-bezier(.22, .78, .2, 1) both; animation-delay: calc(var(--die-index) * 28ms); }
@keyframes stats-die-tumble {
  0% { transform: translateY(0) rotate(0deg) scale(.9); }
  18% { transform: translateY(-6px) rotate(-14deg) scale(1.06); }
  38% { transform: translateY(2px) rotate(11deg) scale(.96); }
  58% { transform: translateY(-3px) rotate(-8deg) scale(1.03); }
  78% { transform: translateY(1px) rotate(5deg) scale(.99); }
  100% { transform: translateY(0) rotate(0deg) scale(1); }
}
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 13px; }
.stat { position: relative; min-width: 0; min-height: 196px; display: flex; flex-direction: column; padding: 16px; overflow: visible; border: 1px solid color-mix(in srgb, var(--border) 88%, transparent); border-radius: calc(var(--r-md) + 2px); background: linear-gradient(145deg, color-mix(in srgb, var(--surface-raised) 72%, var(--surface)), var(--surface)); box-shadow: 0 8px 22px color-mix(in srgb, var(--scrim) 9%, transparent); }
.stat:focus-within { z-index: 20; }
.stat::after { position: absolute; right: 9px; bottom: 9px; width: 64px; height: 64px; border: 1px solid color-mix(in srgb, var(--text-muted) 8%, transparent); border-radius: 50%; content: ''; pointer-events: none; }
.stat.primary { border-color: color-mix(in srgb, var(--accent) 46%, var(--border)); background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 14%, var(--surface-raised)), color-mix(in srgb, var(--accent) 5%, var(--surface))); box-shadow: 0 9px 24px color-mix(in srgb, var(--accent) 10%, transparent); }
.stat.primary::after { border-color: color-mix(in srgb, var(--accent) 15%, transparent); }
.stat-head { position: relative; z-index: 1; min-height: 26px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.stat-identity { min-width: 0; display: flex; align-items: center; gap: 8px; }
.stat-symbol { flex: none; display: inline-grid; place-items: center; width: 30px; height: 30px; border: 1px solid color-mix(in srgb, var(--stat-color) 28%, transparent); border-radius: 9px; background: color-mix(in srgb, var(--stat-color) 10%, transparent); }
.stat-icon { width: 20px; height: 20px; }
.stat-code { color: var(--text-2); font-size: 9px; font-weight: 800; letter-spacing: .06em; }
.stat-name { min-width: 0; color: var(--text-1); font-size: 12px; font-weight: 750; line-height: 1.2; }
.primary-badge { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent) 13%, transparent); color: var(--accent); font-size: 8px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.star { width: 10px; height: 10px; }
.stat-score-row { position: relative; z-index: 1; display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-top: 13px; }
.stat-score, .stat-mod { display: flex; flex-direction: column; gap: 2px; }
.stat-score small, .stat-mod small, .ctl-label { color: var(--text-muted); font-size: 8px; font-weight: 750; letter-spacing: .08em; line-height: 1.1; text-transform: uppercase; }
.stat-score strong { min-height: 40px; color: var(--text-1); font-size: 44px; font-weight: 760; font-variant-numeric: tabular-nums; letter-spacing: -.04em; line-height: .9; }
.stat-score .stat-placeholder { color: var(--text-muted); font-weight: 620; opacity: .58; }
.stat-mod { align-items: flex-end; }
.stat-mod strong { min-width: 44px; padding: 6px 8px; border-radius: 9px; background: color-mix(in srgb, var(--text-muted) 9%, transparent); color: var(--text-2); font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; text-align: center; }
.stat-mod.pos strong { background: color-mix(in srgb, var(--success) 13%, transparent); color: var(--success); }
.stat-mod.neg strong { background: color-mix(in srgb, var(--danger) 13%, transparent); color: var(--danger); }
.stat-breakdown { position: relative; z-index: 1; min-height: 25px; display: flex; align-items: center; gap: 7px; margin-top: 10px; color: var(--text-muted); font-size: 10px; }
.stat-breakdown > span { display: inline-flex; align-items: baseline; gap: 3px; }
.stat-breakdown strong { color: var(--text-2); font-size: 11px; }
.stat-breakdown .base-placeholder { color: var(--text-muted); opacity: .68; }
.stat-breakdown .stat-asi { padding: 3px 6px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent) 11%, transparent); color: var(--accent); }
.stat-breakdown .stat-asi strong { color: inherit; }
.stat-no-asi { opacity: .72; }
.stat-ctl { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: stretch; gap: 6px; margin-top: auto; padding-top: 12px; border-top: 1px solid color-mix(in srgb, var(--border) 72%, transparent); }
.pool-field { display: flex; flex-direction: column; gap: 6px; }
.pool-picker { width: 100%; }
.pool-picker :deep(.vs-button) { min-height: 40px; border-color: var(--border-strong); border-radius: 10px; background: linear-gradient(135deg, color-mix(in srgb, var(--surface-raised) 88%, var(--surface)), var(--surface-raised)); padding: 8px 11px; }
.pool-picker :deep(.vs-button:hover), .pool-picker :deep(.vs-button[aria-expanded="true"]) { border-color: color-mix(in srgb, var(--accent) 68%, var(--border-strong)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 11%, transparent); }
.pool-picker :deep(.vs-button > span:first-child) { color: var(--text-1); font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; }
.pool-picker :deep(.vs-arrow) { color: var(--accent); transition: transform .15s ease; }
.pool-picker :deep(.vs-button[aria-expanded="true"] .vs-arrow) { transform: rotate(180deg); }
.pool-picker :deep(.vs-drop) { min-width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; padding: 6px; border-color: color-mix(in srgb, var(--accent) 34%, var(--border-strong)); border-radius: 12px; background: var(--popover-bg); box-shadow: 0 16px 38px color-mix(in srgb, var(--scrim) 38%, transparent); }
.pool-picker :deep(.vs-option) { min-width: 0; justify-content: center; border: 1px solid color-mix(in srgb, var(--border) 65%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--surface) 78%, transparent); color: var(--text-2); font-size: 12px; font-weight: 750; text-align: center; }
.pool-picker :deep(.vs-option:first-of-type) { grid-column: 1 / -1; }
.pool-picker :deep(.vs-option:hover), .pool-picker :deep(.vs-option--active) { border-color: color-mix(in srgb, var(--accent) 42%, var(--border)); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); color: var(--text-1); }
.pool-picker :deep(.vs-option[aria-selected="true"]) { border-color: color-mix(in srgb, var(--accent) 68%, var(--border)); background: color-mix(in srgb, var(--accent) 17%, var(--surface)); color: var(--accent); }
.stat-stepper { display: grid; grid-template-columns: 36px minmax(38px, 1fr) 36px; align-items: center; min-height: 38px; border: 1px solid var(--border-strong); border-radius: 10px; background: var(--surface-raised); overflow: hidden; }
.step-btn { width: 36px; height: 36px; border: 0; background: transparent; color: var(--text-1); cursor: pointer; font-size: 20px; line-height: 1; }
.step-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); }
.step-btn:disabled { opacity: .35; cursor: default; }
.step-val { min-width: 0; border-inline: 1px solid color-mix(in srgb, var(--border) 70%, transparent); color: var(--text-1); font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 36px; text-align: center; }
.step-cost { min-height: 12px; color: var(--text-muted); font-size: 9px; line-height: 1.2; text-align: center; }
@media (max-width: 820px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .roll-series { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .stats-bar { display: grid; grid-template-columns: 1fr auto; gap: 8px; } .stats-bar :deep(.share-multi-toggle) { grid-column: 1 / -1; width: 100%; } .qb { justify-content: center; min-height: 36px; } .budget { margin-left: 0; justify-self: end; } .roll-btn { width: 100%; justify-content: center; } }
@media (max-width: 460px) { .grid, .roll-series { grid-template-columns: 1fr; } .stat { min-height: 188px; padding: 14px; } }
@media (prefers-reduced-motion: reduce) { .roll-dice > span.rolling { animation: none; } }
</style>
