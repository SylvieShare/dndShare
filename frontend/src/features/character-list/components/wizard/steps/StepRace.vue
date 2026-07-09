<template>
  <div class="step">
    <div class="sheet-section-title">Раса</div>
    <p v-if="loading && !races.length" class="hint">Загрузка справочника…</p>
    <p v-else-if="!races.length" class="hint">В справочнике пока нет рас.</p>
    <div v-else class="grid">
      <SelectTile
        v-for="r in races"
        :key="r.id"
        :title="r.name"
        :subtitle="asiSummary(r)"
        :monogram="monogramOf(r.name)"
        :selected="state.race?.id === r.id"
        @select="state.race = r"
      />
    </div>

    <template v-if="subraces.length">
      <div class="sheet-section-title step-gap">Происхождение</div>
      <div class="grid">
        <SelectTile
          v-for="s in subraces"
          :key="s.id"
          :title="s.name"
          :subtitle="asiSummary(s)"
          :monogram="monogramOf(s.name)"
          :selected="state.subrace?.id === s.id"
          @select="state.subrace = s"
        />
      </div>
    </template>

    <template v-if="state.race && (grants.raceVariants || grants.asiChoice)">
      <div class="sheet-section-title step-gap">Выборы расы</div>

      <div v-if="grants.raceVariants" class="opts">
        <div
          v-for="v in grants.raceVariants"
          :key="v.value"
          class="opt"
          :class="{ on: state.raceVariant === v.value }"
          @click="state.raceVariant = v.value"
        >
          <span class="box radio"><svg v-if="state.raceVariant === v.value" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" /></svg></span>
          <div class="opt-body">
            <div class="opt-label">{{ v.label }}</div>
            <div v-if="v.desc" class="opt-desc">{{ v.desc }}</div>
          </div>
        </div>
      </div>

      <div v-if="grants.asiChoice" class="asi">
        <p class="hint">
          Прибавь +{{ grants.asiChoice.bonus }} к {{ grants.asiChoice.count }} характеристикам на выбор
          <span class="count" :class="{ done: state.asiChoice.length === grants.asiChoice.count }">{{ state.asiChoice.length }} / {{ grants.asiChoice.count }}</span>
        </p>
        <div class="asi-chips">
          <button
            v-for="s in STATS"
            :key="s"
            class="asi-chip"
            :class="{ on: state.asiChoice.includes(s), off: !state.asiChoice.includes(s) && atAsiLimit }"
            @click="toggleAsiChoice(s)"
          >
            {{ STAT_SHORT[s] }} <b>+{{ grants.asiChoice.bonus }}</b>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import SelectTile from '@/features/character-list/components/wizard/SelectTile.vue'
import { STAT_SHORT, asiSummary, monogramOf } from '@/features/character-list/components/wizard/labels'

const { races, subraces, state, loading, grants, STATS, toggleAsiChoice } = inject('createWizard')
const atAsiLimit = computed(() => grants.value.asiChoice && state.asiChoice.length >= grants.value.asiChoice.count)
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.step-gap { margin-top: 8px; }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; display: flex; align-items: center; gap: 8px; }
.count { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.count.done { color: var(--success); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }

.opts { display: flex; flex-wrap: wrap; gap: 8px; }
.opt {
  display: flex; align-items: flex-start; gap: 11px; flex: 1 1 220px;
  background: var(--block-bg); border-radius: var(--r-md); padding: 11px 13px; cursor: pointer; transition: background 0.15s;
}
.opt:hover { background: color-mix(in srgb, var(--accent) 12%, var(--block-bg)); }
.opt.on { background: color-mix(in srgb, var(--accent) 16%, var(--block-bg)); }
.box { flex-shrink: 0; width: 18px; height: 18px; margin-top: 1px; border-radius: 50%; background: var(--bg); display: flex; align-items: center; justify-content: center; }
.opt.on .box { background: var(--accent); }
.box svg { width: 12px; height: 12px; color: #fff; }
.opt-body { min-width: 0; }
.opt-label { font-size: 14px; color: var(--text-1); font-weight: 500; }
.opt-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.asi { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.asi-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.asi-chip {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--block-bg); border: none; border-radius: 999px;
  color: var(--text-2); font: inherit; font-size: 12px; padding: 6px 13px; cursor: pointer; transition: background 0.15s;
}
.asi-chip b { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.asi-chip:hover { background: color-mix(in srgb, var(--accent) 14%, var(--block-bg)); }
.asi-chip.on { background: var(--accent); color: #fff; }
.asi-chip.on b { color: #fff; }
.asi-chip.off { opacity: 0.4; cursor: default; }
.asi-chip.off:hover { background: var(--block-bg); }
</style>
