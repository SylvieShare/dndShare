<template>
  <div class="step">
    <div class="rv-hero">
      <div class="rv-mono">{{ mono }}</div>
      <div class="rv-idcol">
        <input class="rv-name" v-model="state.name" placeholder="Безымянный герой" />
        <div class="rv-sub">{{ [subraceOrRace, klass].filter(Boolean).join(' · ') || '—' }} · Уровень 1</div>
      </div>
    </div>

    <div class="rv-stats">
      <div v-for="s in STATS" :key="s" class="rv-stat">
        <span class="rv-stat-k">{{ STAT_SHORT[s] }}<i v-if="grants.saves.includes(s)" class="save-dot" title="Владение спасброском" /></span>
        <span class="rv-stat-v">{{ finalScores[s] }}</span>
        <span class="rv-stat-m" :class="modClass(mods[s])">{{ formatMod(mods[s]) }}</span>
      </div>
    </div>

    <div class="rv-chips">
      <span v-if="maxHp != null" class="rv-chip"><b>{{ maxHp }}</b> хиты</span>
      <span class="rv-chip"><b>{{ unarmoredAc }}</b> КД</span>
      <span class="rv-chip">Иниц. <b>{{ formatMod(initiativeMod) }}</b></span>
      <span v-if="spellDc != null" class="rv-chip">Сл.закл. <b>{{ spellDc }}</b></span>
      <span v-if="spellAtk != null" class="rv-chip">Атака закл. <b>{{ formatMod(spellAtk) }}</b></span>
    </div>

    <div v-for="row in summary" :key="row.k" class="rv-row">
      <span class="rv-row-k">{{ row.k }}</span>
      <span class="rv-row-v">{{ row.v }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { STAT_SHORT, formatMod, monogramOf } from '@/features/character-list/components/wizard/labels'

const wz = inject('createWizard')
const {
  STATS, state, grants, finalScores, mods, maxHp, unarmoredAc, initiativeMod, spellDc, spellAtk,
  skillOptions, cantripPool, spell1Pool, suggestValue, raceAbilities, classAbilities,
} = wz

const mono = computed(() => monogramOf(state.charClass?.name || state.race?.name || '?'))
const subraceOrRace = computed(() => state.subrace?.name || state.race?.name || '')
const klass = computed(() => [state.charClass?.name, state.subclass?.name].filter(Boolean).join(' · '))
function modClass(m) { return m > 0 ? 'pos' : m < 0 ? 'neg' : '' }

const summary = computed(() => {
  const out = []
  const skills = skillOptions.value.filter((o) => state.skillIds.includes(o.id)).map((o) => o.name)
  if (skills.length) out.push({ k: 'Навыки', v: skills.join(', ') })
  const langs = grants.value.languages.map((id) => suggestValue(6, id)).filter(Boolean)
  if (langs.length) out.push({ k: 'Языки', v: langs.join(', ') })
  const feats = [
    ...featuresForBinding(raceAbilities.value, { raceId: state.race?.id, subraceId: state.subrace?.id }, 1),
    ...featuresForBinding(classAbilities.value, { classId: state.charClass?.id, subclassId: state.subclass?.id }, 1),
  ].map((i) => i.name)
  if (feats.length) out.push({ k: 'Способности', v: feats.join(', ') })
  const spells = [...cantripPool.value, ...spell1Pool.value].filter((sp) => state.spellIds.includes(sp.id)).map((sp) => sp.name)
  if (spells.length) out.push({ k: 'Заклинания', v: spells.join(', ') })
  return out
})
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 16px; }
.rv-hero { display: flex; align-items: center; gap: 14px; }
.rv-mono {
  flex-shrink: 0; width: 60px; height: 60px; border-radius: 15px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-size: 32px; font-weight: 600; color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}
.rv-idcol { min-width: 0; }
.rv-name { width: 100%; background: none; border: none; font-family: var(--font-display); font-size: 26px; font-weight: 600; color: var(--warning); line-height: 1.1; padding: 0; outline: none; }
.rv-name::placeholder { color: color-mix(in srgb, var(--warning) 45%, transparent); }
.rv-sub { font-size: 13px; color: var(--text-2); margin-top: 2px; }

.rv-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
.rv-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; background: var(--block-bg); border-radius: var(--r-md); padding: 10px 4px; }
.rv-stat-k { font-size: 10px; letter-spacing: 0.04em; color: var(--text-muted); display: inline-flex; align-items: center; gap: 3px; }
.save-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); display: inline-block; }
.rv-stat-v { font-size: 22px; font-weight: 700; color: var(--text-1); font-variant-numeric: tabular-nums; line-height: 1; }
.rv-stat-m { font-size: 12px; font-weight: 600; color: var(--text-2); font-variant-numeric: tabular-nums; }
.rv-stat-m.pos { color: var(--success); }
.rv-stat-m.neg { color: var(--danger); }

.rv-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.rv-chip { font-size: 12px; color: var(--text-2); background: var(--block-bg); border-radius: var(--r-sm); padding: 4px 11px; }
.rv-chip b { color: var(--text-1); font-variant-numeric: tabular-nums; }

.rv-row { display: flex; gap: 12px; border-top: 1px solid var(--border); padding-top: 11px; }
.rv-row-k { flex-shrink: 0; width: 96px; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); padding-top: 1px; }
.rv-row-v { flex: 1; font-size: 13px; color: var(--text-1); line-height: 1.5; }
</style>
