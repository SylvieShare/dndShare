<template>
  <div class="step">
    <div class="stats-bar">
      <MultiToggle :options="methodOptions" :model-value="state.statMethod" @update:model-value="setMethod" />
      <button type="button" class="qb" title="Раскидать стандартный набор по классу" @click="quickBuild">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h7l-1 8 10-12h-7z" /></svg>
        Быстрая сборка
      </button>
      <span v-if="state.statMethod === 'pointbuy'" class="budget" :class="{ over: pointsLeft < 0 }">Осталось <b>{{ pointsLeft }}</b> / {{ BUDGET }}</span>
    </div>

    <p class="hint">{{ hint }}</p>

    <div v-if="state.statMethod === 'roll'" class="roll-cta">
      <button type="button" class="roll-btn" @click="rollStats">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /><circle cx="16" cy="16" r="1.4" fill="currentColor" /><circle cx="16" cy="8" r="1.4" fill="currentColor" /><circle cx="8" cy="16" r="1.4" fill="currentColor" /></svg>
        {{ state.rollPool.length ? 'Перебросить 4d6 ×6' : 'Бросить 4d6 ×6' }}
      </button>
      <span v-if="state.rollPool.length" class="roll-pool">Выпало: {{ state.rollPool.join(' · ') }}</span>
    </div>

    <div class="grid">
      <div v-for="s in STATS" :key="s" class="stat" :class="{ primary: primaryAbilities.includes(s) }">
        <span v-if="primaryAbilities.includes(s)" class="stat-strip" />
        <div class="stat-head">
          <span class="stat-name">{{ STAT_FULL[s] }}</span>
          <svg v-if="primaryAbilities.includes(s)" class="star" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3L22 9.3l-5 5 1.2 7L12 17.8 5.8 21.3 7 14.3l-5-5 7.1-1z" /></svg>
        </div>

        <div class="stat-nums">
          <span class="stat-final">{{ assigned(s) ? finalScores[s] : '—' }}</span>
          <span v-if="assigned(s)" class="stat-mod" :class="modClass(mods[s])">{{ formatMod(mods[s]) }}</span>
        </div>
        <div v-if="asiFor(s)" class="stat-asi">+{{ asiFor(s) }} от расы</div>

        <div class="stat-ctl">
          <template v-if="state.statMethod === 'pointbuy'">
            <button class="step-btn" :disabled="(state.scores[s] ?? 8) <= 8" @click="bump(s, -1)">−</button>
            <span class="step-val">{{ state.scores[s] ?? 8 }}</span>
            <span class="next-step"><button class="step-btn" :disabled="(state.scores[s] ?? 8) >= 15 || pointsLeft < costStep(s)" @click="bump(s, 1)">+</button><small v-if="(state.scores[s] ?? 8) < 15">{{ costStep(s) }} очк.</small></span>
          </template>
          <select v-else class="pool-select" :value="state.scores[s] ?? ''" @change="assign(s, $event.target.value)">
            <option value="">—</option>
            <option v-for="(v, i) in pool" :key="i" :value="v" :disabled="isUsed(v, s)">{{ v }}</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import MultiToggle from '@/shared/ui/MultiToggle.vue'
import { POINT_BUY_BUDGET, STANDARD_ARRAY, pointCost } from '@/features/character-list/composables/useDndCreateWizard'
import { STAT_FULL, formatMod } from '@/features/character-list/components/wizard/labels'

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

function assigned(s) { return state.scores[s] != null }
function asiFor(s) { return (grants.value.asi || []).filter((a) => a.stat === s).reduce((sum, a) => sum + a.bonus, 0) }
function modClass(m) { return m > 0 ? 'pos' : m < 0 ? 'neg' : '' }

function isUsed(v, stat) { return STATS.some((s) => s !== stat && Number(state.scores[s]) === Number(v)) }
function assign(stat, raw) { state.scores[stat] = raw === '' ? null : Number(raw) }
function costStep(stat) {
  const cur = state.scores[stat] ?? 8
  return pointCost(Math.min(cur + 1, 15)) - pointCost(cur)
}
function bump(stat, dir) {
  const cur = state.scores[stat] ?? 8
  state.scores[stat] = Math.max(8, Math.min(15, cur + dir))
}
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
.roll-cta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.roll-btn { display: inline-flex; align-items: center; gap: 8px;
  background: var(--accent); color: var(--text-on-accent); border: none; border-radius: 9px;
  padding: 10px 18px; font: inherit; font-weight: 600; cursor: pointer;
}
.roll-btn svg { width: 17px; height: 17px; }
.roll-pool { font-size: 13px; font-weight: 700; color: var(--text-1); font-variant-numeric: tabular-nums; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 11px; }
.stat { position: relative;
  background: var(--surface);
  border-radius: var(--r-md);
  padding: 11px 13px 12px;
  overflow: hidden;
}
.stat.primary { background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
.stat-strip { position: absolute; top: 8px; bottom: 8px; left: 0; width: 3px; border-radius: 0 2px 2px 0; background: var(--accent); }
.stat-head { display: flex; align-items: center; gap: 6px; }
.stat-name { font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); font-weight: 650; }
.star { width: 12px; height: 12px; color: var(--accent); }
.stat-nums { display: flex; align-items: baseline; gap: 8px; margin-top: 4px; }
.stat-final { font-size: 30px; font-weight: 700; color: var(--text-1); font-variant-numeric: tabular-nums; line-height: 1; }
.stat-mod { font-size: 13px; font-weight: 600; color: var(--text-2); font-variant-numeric: tabular-nums; }
.stat-mod.pos { color: var(--success); }
.stat-mod.neg { color: var(--danger); }
.stat-asi { font-size: 10px; color: var(--accent); margin-top: 3px; }
.stat-ctl { display: flex; align-items: center; gap: 8px; margin-top: 9px; }
.pool-select { flex: 1; background: var(--surface-raised); border: 1px solid var(--border-strong); border-radius: 7px;
  color: var(--text-1); font: inherit; font-size: 13px; padding: 6px 8px; outline: none;
}
.pool-select:focus { border-color: var(--accent); }
.step-btn { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--border-strong);
  background: var(--surface-raised); color: var(--text-1); cursor: pointer; font-size: 16px; line-height: 1;
}
.step-btn:disabled { opacity: 0.4; cursor: default; }
.step-val { min-width: 26px; text-align: center; font-weight: 700; color: var(--text-1); font-variant-numeric: tabular-nums; }
.next-step { display: inline-flex; align-items: center; gap: 4px; }
.next-step small { color: var(--text-muted); font-size: 10px; font-weight: 650; white-space: nowrap; }
@media (max-width: 640px) { .stats-bar { display: grid; grid-template-columns: 1fr auto; gap: 8px; } .stats-bar :deep(.mt-toggle) { grid-column: 1 / -1; width: 100%; } .qb { justify-content: center; min-height: 36px; } .budget { margin-left: 0; justify-self: end; } .roll-cta { align-items: stretch; } .roll-btn { width: 100%; justify-content: center; } .roll-pool { width: 100%; text-align: center; } }
</style>
