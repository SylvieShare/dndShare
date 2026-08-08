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

    <div v-if="isEmpty" class="pv-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.5" /></svg>
      <span>Выборы будут появляться здесь и постепенно соберутся в персонажа.</span>
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

    <div v-if="sections.length" class="pv-block pv-grants-wrap">
      <div class="pv-grants-title">Что получаете</div>
      <div v-for="sec in sections" :key="sec.title" class="pv-sec">
        <div class="pv-sec-h">{{ sec.title }}</div>
        <ul class="pv-grants">
          <li v-for="(g, i) in sec.items" :key="i">
            <span class="gk">{{ g.k }}</span>
            <template v-if="g.abilities">
              <template v-for="(ab, j) in g.abilities" :key="j"><span
                class="pv-ability"
                @mouseenter="(e) => showTooltip(e, ab)"
                @mouseleave="hideTooltip"
              >{{ ab.name }}<span v-if="ab.choices.length" class="pv-ability-choice">: {{ ab.choices.join(', ') }}</span></span><span v-if="j < g.abilities.length - 1">, </span></template>
            </template>
            <template v-else>{{ g.v }}</template>
          </li>
        </ul>
      </div>
    </div>

    <ItemTooltip
      v-if="tooltip.visible"
      :title="tooltip.name"
      :desc="tooltip.desc"
      :x="tooltip.x"
      :top="tooltip.top"
      :bottom="tooltip.bottom"
    >
      <template v-if="tooltip.item && (tooltip.item.data?.max_use || tooltip.item.data?.rollback_short_rest || tooltip.item.data?.rollback_long_rest)" #details>
        <AbilityTooltipDetails :item="tooltip.item" />
      </template>
    </ItemTooltip>
  </aside>
</template>

<script setup>
import { computed, inject, reactive } from 'vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import AbilityTooltipDetails from '@/features/items/detail-components/AbilityTooltipDetails'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { STAT_SHORT, formatMod, monogramOf } from '@/features/character-list/components/wizard/labels'

const wz = inject('createWizard')
const {
  STATS, state, grants, mods, finalScores, maxHp, unarmoredAc, initiativeMod, spellDc,
  suggestValue, raceAbilities, classAbilities, featPool, spellPool, randomName, racialBonus,
} = wz

const mono = computed(() => monogramOf(state.charClass?.name || state.race?.name || '?'))
const raceLine = computed(() => [state.subrace?.name || state.race?.name].filter(Boolean).join(''))
const classLine = computed(() => [state.charClass?.name, state.subclass?.name].filter(Boolean).join(' · '))
const scoresEntered = computed(() => STATS.some((s) => state.scores[s] != null))
const showStats = computed(() => !!state.race || scoresEntered.value)
function modClass(m) { return m > 0 ? 'pos' : m < 0 ? 'neg' : '' }

// Proficiency labels declared directly on one handbook item's data — so each
// prof is attributed to its true source (race vs class), not the merged grants.
function itemProfs(item) {
  const d = item?.data || {}
  return [
    ...(d.armor_prof || []).map((id) => suggestValue(3, id)),
    ...(d.weapon_prof || []).map((id) => suggestValue(4, id)),
    ...(d.tool_prof || []).map((id) => suggestValue(5, id)),
  ].filter(Boolean)
}
function choiceLabels(item) {
  const choice = item?.data?.choice
  const selected = state.choices[item?.id] || []
  if (!choice || !selected.length) return []
  if (choice.from_suggest_id) {
    return selected.map((id) => suggestValue(Number(choice.from_suggest_id), id) || `#${id}`)
  }
  return selected.map((value) => {
    const option = (choice.options || []).find((o) => String(o.value ?? o.label) === String(value))
    return option?.label || String(value)
  })
}
function featureList(items, binding) {
  return featuresForBinding(items, binding, 1)
    .filter((i) => i.name)
    .map((i) => ({ name: i.name, desc: i.data?.desc || '', item: i, choices: choiceLabels(i) }))
}

const tooltip = reactive({ visible: false, name: '', desc: '', item: null, x: 0, top: null, bottom: null })
function showTooltip(e, ab) {
  if (!ab.desc) return
  const rect = e.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 220
  Object.assign(tooltip, {
    visible: true, name: ab.name, desc: ab.desc, item: ab.item,
    x: Math.min(rect.left, window.innerWidth - 350),
    top: above ? null : rect.bottom + 8,
    bottom: above ? window.innerHeight - rect.top + 8 : null,
  })
}
function hideTooltip() { tooltip.visible = false }
function names(ids, typeId) { return ids.map((id) => suggestValue(typeId, id)).filter(Boolean) }
function push(items, k, v) { if (v && v.length) items.push({ k, v }) }
function pushAbilities(items, abilities) { if (abilities.length) items.push({ k: 'Способности', abilities }) }

// Every bonus the character accrues, grouped by the wizard step that grants it —
// so it's easy to see what each choice adds and to spot leftovers after a rollback.
const sections = computed(() => {
  const g = grants.value
  const out = []

  if (state.race) {
    const items = []
    push(items, 'Характеристики', (g.asi || []).map((a) => `${STAT_SHORT[a.stat]} +${a.bonus}`).join(', '))
    if (g.asiChoice && state.asiChoice.length) push(items, 'Бонус на выбор', state.asiChoice.map((s) => `${STAT_SHORT[s]} +${g.asiChoice.bonus}`).join(', '))
    push(items, 'Скорость', g.speed != null ? `${g.speed} фт` : '')
    push(items, 'Размер', g.size || '')
    push(items, 'Языки', names(g.languages, 6).join(', '))
    push(items, 'Доп. язык', names(state.raceLangIds, 6).join(', '))
    push(items, 'Навыки расы', names(state.raceSkillIds, 15).join(', '))
    push(items, 'Черта', state.featIds.map((id) => featPool.value.find((f) => f.id === id)?.name).filter(Boolean).join(', '))
    push(items, 'Владения', [...itemProfs(state.race.item), ...itemProfs(state.subrace?.item)].join(', '))
    pushAbilities(items, featureList(raceAbilities.value, { raceId: state.race?.id, subraceId: state.subrace?.id }))
    if (items.length) out.push({ title: 'Раса', items })
  }

  if (state.charClass) {
    const items = []
    push(items, 'Кость хитов', g.hitDieId ? suggestValue(11, g.hitDieId) : '')
    push(items, 'Спасброски', g.saves.map((s) => STAT_SHORT[s]).join(', '))
    push(items, 'Владения', [...itemProfs(state.charClass.item), ...itemProfs(state.subclass?.item)].join(', '))
    if (g.spellcasting?.stat) push(items, 'Магия', `заклинатель (${STAT_SHORT[g.spellcasting.stat]})`)
    pushAbilities(items, featureList(classAbilities.value, { classId: state.charClass?.id, subclassId: state.subclass?.id }))
    if (items.length) out.push({ title: 'Класс', items })
  }

  if (state.background) {
    const items = []
    const bd = state.background.data || {}
    push(items, 'Навыки', names(g.backgroundSkills || [], 15).join(', '))
    push(items, 'Инструменты', names(bd.tool_prof || [], 5).join(', '))
    push(items, 'Языки', names(state.bgLangIds, 6).join(', '))
    if (bd.feature) push(items, 'Черта', bd.feature)
    if (items.length) out.push({ title: 'Предыстория', items })
  }

  if (state.skillIds.length) out.push({ title: 'Навыки', items: [{ k: 'Владение', v: names(state.skillIds, 15).join(', ') }] })

  if (state.spellIds.length) {
    const spellNames = state.spellIds.map((id) => spellPool.value.find((sp) => sp.id === id)?.name).filter(Boolean)
    if (spellNames.length) out.push({ title: 'Магия', items: [{ k: 'Заклинания', v: spellNames.join(', ') }] })
  }

  if (state.equipment.length) {
    out.push({ title: 'Снаряжение', items: [{ k: 'Предметы', v: state.equipment.map((e) => e.count > 1 ? `${e.name} ×${e.count}` : e.name).join(', ') }] })
  }

  return out
})
const isEmpty = computed(() => !showStats.value && !sections.value.length)
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

.pv-empty {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  padding: 11px;
  border: 1px dashed color-mix(in srgb, var(--border-strong) 72%, transparent);
  border-radius: 9px;
  color: var(--wizard-muted, var(--text-muted));
  font-size: 11px;
  line-height: 1.4;
}
.pv-empty svg { flex-shrink: 0; width: 16px; height: 16px; margin-top: 1px; color: var(--accent); }

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

.pv-grants-title { font-size: 11px; font-weight: 650; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
.pv-sec + .pv-sec { margin-top: 12px; }
.pv-sec-h {
  font-family: var(--font-display); font-size: 14px; font-weight: 600; color: var(--text-1);
  padding-bottom: 5px; margin-bottom: 7px; border-bottom: 1px solid var(--border);
}
.pv-grants { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pv-grants li { font-size: 12px; color: var(--text-2); line-height: 1.35; }
.gk { display: block; font-size: 10px; letter-spacing: 0.03em; text-transform: uppercase; color: var(--text-muted); }
.pv-ability { cursor: help; text-decoration: underline dotted; text-underline-offset: 2px; text-decoration-color: var(--text-muted); }
.pv-ability-choice { color: var(--text-1); text-decoration: none; }
.pv-ability:hover { color: var(--text-1); text-decoration-color: var(--accent); }
</style>
