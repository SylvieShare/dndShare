<template>
  <aside class="pv">
    <div class="pv-name">
      <input v-model="state.name" type="text" placeholder="Имя персонажа" />
      <button class="dice" title="Случайное имя" @click="randomName">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" /><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" /><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" /></svg>
      </button>
    </div>

    <div class="pv-hero">
      <div class="pv-mono">{{ mono }}</div>
      <div class="pv-id">
        <div class="pv-line">{{ raceLine || '—' }}</div>
        <div class="pv-line">{{ classLine || '—' }}</div>
        <span class="pv-lvl">Уровень 1</span>
      </div>
    </div>

    <div v-if="showStats" class="pv-block">
      <div class="pv-cap">{{ scoresEntered ? 'Характеристики' : 'Бонусы расы к значению' }}</div>
      <div class="pv-stats">
        <div v-for="s in STATS" :key="s" class="pv-stat">
          <span class="pv-stat-k">{{ STAT_SHORT[s] }}</span>
          <template v-if="scoresEntered">
            <span class="pv-stat-score">{{ finalScores[s] }}</span>
            <span class="pv-stat-mod" :class="modClass(mods[s])">{{ formatMod(mods[s]) }}</span>
          </template>
          <span v-else class="pv-stat-bonus" :class="{ has: racialBonus(s) > 0 }">{{ racialBonus(s) > 0 ? '+' + racialBonus(s) : '—' }}</span>
        </div>
      </div>
      <div v-if="scoresEntered" class="pv-derived">
        <span v-if="maxHp != null" class="pv-chip"><b>{{ maxHp }}</b> хиты</span>
        <span class="pv-chip"><b>{{ unarmoredAc }}</b> КД</span>
        <span class="pv-chip">Иниц. <b>{{ formatMod(initiativeMod) }}</b></span>
        <span v-if="spellDc != null" class="pv-chip">Сл.закл. <b>{{ spellDc }}</b></span>
      </div>
    </div>

    <div v-if="grantLines.length" class="pv-block">
      <div class="pv-grants-title">Вы получите</div>
      <ul class="pv-grants">
        <li v-for="(g, i) in grantLines" :key="i"><span class="gk">{{ g.k }}</span>{{ g.v }}</li>
      </ul>
    </div>
  </aside>
</template>

<script setup>
import { computed, inject } from 'vue'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { STAT_SHORT, formatMod, monogramOf } from '@/features/character-list/components/wizard/labels'

const wz = inject('createWizard')
const {
  STATS, state, grants, mods, finalScores, maxHp, unarmoredAc, initiativeMod, spellDc,
  suggestValue, raceAbilities, classAbilities, randomName,
} = wz

const mono = computed(() => monogramOf(state.charClass?.name || state.race?.name || '?'))
const raceLine = computed(() => [state.subrace?.name || state.race?.name].filter(Boolean).join(''))
const classLine = computed(() => [state.charClass?.name, state.subclass?.name].filter(Boolean).join(' · '))
const scoresEntered = computed(() => STATS.some((s) => state.scores[s] != null))
const showStats = computed(() => !!state.race || scoresEntered.value)
function modClass(m) { return m > 0 ? 'pos' : m < 0 ? 'neg' : '' }
// Racial bonus for a stat (fixed ASI + chosen floating). Shown before ability
// scores are picked, so no misleading negative modifiers appear.
function racialBonus(s) {
  const fixed = (grants.value.asi || []).filter((a) => a.stat === s).reduce((x, a) => x + a.bonus, 0)
  const floating = state.asiChoice.includes(s) ? (grants.value.asiChoice?.bonus || 0) : 0
  return fixed + floating
}

const grantLines = computed(() => {
  const g = grants.value
  const out = []
  if (g.speed != null) out.push({ k: 'Скорость', v: `${g.speed} фт` })
  if (g.size) out.push({ k: 'Размер', v: g.size })
  if (g.hitDieId) out.push({ k: 'Кость хитов', v: suggestValue(11, g.hitDieId) || '—' })
  if (g.saves.length) out.push({ k: 'Спасброски', v: g.saves.map((s) => STAT_SHORT[s]).join(', ') })
  const profs = [
    ...g.proficiencies.armor.map((id) => suggestValue(3, id)),
    ...g.proficiencies.weapon.map((id) => suggestValue(4, id)),
    ...g.proficiencies.tool.map((id) => suggestValue(5, id)),
  ].filter(Boolean)
  if (profs.length) out.push({ k: 'Владения', v: profs.join(', ') })
  const langs = g.languages.map((id) => suggestValue(6, id)).filter(Boolean)
  if (langs.length) out.push({ k: 'Языки', v: langs.join(', ') })
  const feats = [
    ...featuresForBinding(raceAbilities.value, { raceId: state.race?.id, subraceId: state.subrace?.id }, 1),
    ...featuresForBinding(classAbilities.value, { classId: state.charClass?.id, subclassId: state.subclass?.id }, 1),
  ].map((i) => i.name).filter(Boolean)
  if (feats.length) out.push({ k: 'Способности', v: feats.join(', ') })
  return out
})
</script>

<style scoped>
.pv { display: flex; flex-direction: column; gap: 14px; }
.pv-name { position: relative; display: flex; align-items: center; }
.pv-name input {
  width: 100%; box-sizing: border-box; background: var(--bg); border: 1px solid var(--input-border);
  border-radius: 9px; color: var(--text-1); font: inherit; font-family: var(--font-display); font-size: 18px;
  padding: 8px 38px 8px 12px; outline: none;
}
.pv-name input:focus { border-color: var(--input-focus); }
.dice { position: absolute; right: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: none; border: none; color: var(--text-muted); cursor: pointer; }
.dice:hover { color: var(--accent); }
.dice svg { width: 17px; height: 17px; }

.pv-hero { display: flex; align-items: center; gap: 12px; }
.pv-mono {
  flex-shrink: 0; width: 56px; height: 56px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-size: 30px; font-weight: 600; color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}
.pv-id { min-width: 0; }
.pv-line { font-family: var(--font-display); font-size: 16px; color: var(--text-1); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pv-line + .pv-line { color: var(--text-2); font-size: 14px; }
.pv-lvl { display: inline-block; margin-top: 5px; font-size: 11px; font-weight: 600; background: color-mix(in srgb, var(--accent) 22%, transparent); color: #c4a0ff; border-radius: 5px; padding: 2px 8px; }

.pv-block { border-top: 1px solid var(--border); padding-top: 12px; }
.pv-cap { font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
.pv-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; }
.pv-stat { display: flex; flex-direction: column; align-items: center; gap: 1px; background: var(--block-bg); border-radius: var(--r-sm); padding: 5px 2px 4px; }
.pv-stat-k { font-size: 9px; letter-spacing: 0.03em; color: var(--text-muted); font-weight: 650; }
.pv-stat-score { font-size: 17px; font-weight: 700; color: var(--text-1); font-variant-numeric: tabular-nums; line-height: 1.1; }
.pv-stat-mod { font-size: 10px; font-weight: 600; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.pv-stat-mod.pos { color: var(--success); }
.pv-stat-mod.neg { color: var(--danger); }
.pv-stat-bonus { font-size: 15px; font-weight: 700; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.pv-stat-bonus.has { color: var(--accent); }
.pv-derived { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.pv-chip { font-size: 11px; color: var(--text-2); background: var(--block-bg); border-radius: var(--r-sm); padding: 3px 9px; }
.pv-chip b { color: var(--text-1); font-variant-numeric: tabular-nums; }

.pv-grants-title { font-size: 11px; font-weight: 650; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
.pv-grants { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.pv-grants li { font-size: 12px; color: var(--text-2); line-height: 1.35; }
.gk { display: block; font-size: 10px; letter-spacing: 0.03em; text-transform: uppercase; color: var(--text-muted); }
</style>
