import { abilityModifier, proficiencyBonus } from '@/shared/lib/dnd'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { SKILL_BY_STAT, buildCharacterData } from '@/features/character-editor/settings/dnd/creation/buildCharacter'
import { STAT_KEYS, SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { extractGrants } from '@/features/character-editor/settings/dnd/creation/grants'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { useSuggestStore } from '@/stores/suggest'

const RACE_TYPE = 8
const CLASS_TYPE = 9
const RACE_ABIL_TYPE = 3
const CLASS_ABIL_TYPE = 4
const SPELL_TYPE = 5
const FEAT_TYPE = 7
const SKILL_SUGGEST = 15
const LANG_SUGGEST = 6
const STATS = STAT_KEYS
const STAT_BY_SUGGEST16 = SUGGEST16_TO_STAT
const NAME_POOL = ['Талион', 'Мираэль', 'Гром', 'Лиа', 'Кадан', 'Сельена', 'Дорн', 'Аэлита', 'Вэйлин', 'Мирра', 'Торин', 'Ниала', 'Ксандер', 'Элара', 'Роган', 'Сафира']

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
export const POINT_BUY_BUDGET = 27
const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }

export function pointCost(score) {
  return POINT_COST[score] ?? 0
}

function emptyScores() {
  return Object.fromEntries(STATS.map((s) => [s, null]))
}

function roll4d6DropLowest() {
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6))
  dice.sort((a, b) => a - b)
  return dice[1] + dice[2] + dice[3]
}

/** Wizard state + data loading + payload assembly for D&D character creation. */
export function useDndCreateWizard() {
  const suggestStore = useSuggestStore()
  ;[3, 4, 5, 6, 7, 11, 15, 16].forEach((t) => suggestStore.ensure(t))

  const races = ref([])
  const classes = ref([])
  const subraces = ref([])
  const subclasses = ref([])
  const raceAbilities = ref([])
  const classAbilities = ref([])
  const spellPool = ref([])
  const featPool = ref([])
  const loading = ref(false)

  const state = reactive({
    step: 0,
    version: '2014',
    name: '',
    race: null,
    subrace: null,
    charClass: null,
    subclass: null,
    raceVariant: null,
    statMethod: 'array',
    scores: emptyScores(),
    rollPool: [],
    asiChoice: [],
    raceSkillIds: [],
    raceLangIds: [],
    featIds: [],
    skillIds: [],
    spellIds: [],
    choices: {},
  })
  // True while restoring from localStorage — suppresses the reset watchers below.
  let hydrating = false

  async function load() {
    loading.value = true
    try {
      const [r, c, ra, ca, ft] = await Promise.all([
        fetchGet(`/items?typeId=${RACE_TYPE}&limit=300`),
        fetchGet(`/items?typeId=${CLASS_TYPE}&limit=300`),
        fetchGet(`/items?typeId=${RACE_ABIL_TYPE}&limit=500`),
        fetchGet(`/items?typeId=${CLASS_ABIL_TYPE}&limit=500`),
        fetchGet(`/items?typeId=${FEAT_TYPE}&limit=500`),
      ])
      // Base races/classes only — subraces/subclasses are children (parentId set).
      races.value = (r?.items || []).filter((i) => !i.parentId)
      classes.value = (c?.items || []).filter((i) => !i.parentId)
      raceAbilities.value = ra?.items || []
      classAbilities.value = ca?.items || []
      featPool.value = ft?.items || []
    } finally {
      loading.value = false
    }
  }

  watch(() => state.race, async (r) => {
    if (hydrating) return
    state.subrace = null
    state.raceVariant = null
    subraces.value = r ? ((await fetchGet(`/items/children?parentId=${r.id}`))?.items || []).filter((i) => i.typeId === RACE_TYPE) : []
  })
  watch(() => state.charClass, async (c) => {
    if (hydrating) return
    state.subclass = null
    subclasses.value = c ? ((await fetchGet(`/items/children?parentId=${c.id}`))?.items || []).filter((i) => i.typeId === CLASS_TYPE) : []
  })
  // A different race/subrace/variant means a different set of race offers — clear the picks.
  watch(() => [state.race?.id, state.subrace?.id, state.raceVariant], () => {
    if (hydrating) return
    state.asiChoice = []
    state.raceSkillIds = []
    state.raceLangIds = []
    state.featIds = []
  })

  function suggestValue(typeId, id) {
    const it = suggestStore.items(typeId).find((s) => String(s.id) === String(id))
    return it?.value || ''
  }

  const grants = computed(() => extractGrants({
    race: state.race,
    subrace: state.subrace,
    charClass: state.charClass,
    subclass: state.subclass,
    raceVariant: state.raceVariant,
  }))

  const isCaster = computed(() => !!grants.value.spellcasting)

  const skillOptions = computed(() => (grants.value.skillChoice?.from || []).map((id) => ({
    id,
    name: suggestValue(15, id) || `#${id}`,
  })))
  const skillLimit = computed(() => grants.value.skillChoice?.count || 0)

  // Final ability scores = chosen base + racial ASI (fixed + floating choice).
  const finalScores = computed(() => {
    const out = {}
    const floatBonus = grants.value.asiChoice?.bonus || 0
    for (const s of STATS) {
      const base = Number(state.scores[s] ?? 0)
      const asi = (grants.value.asi || []).filter((a) => a.stat === s).reduce((sum, a) => sum + a.bonus, 0)
      const floating = state.asiChoice.includes(s) ? floatBonus : 0
      out[s] = base + asi + floating
    }
    return out
  })

  // Floating racial ASI ("choose N abilities, +V each" — Variant Human, Half-Elf).
  function toggleAsiChoice(stat) {
    const i = state.asiChoice.indexOf(stat)
    if (i >= 0) { state.asiChoice.splice(i, 1); return }
    const limit = grants.value.asiChoice?.count || 0
    if (limit && state.asiChoice.length >= limit) return
    state.asiChoice.push(stat)
  }
  const asiChoiceComplete = computed(() => {
    const c = grants.value.asiChoice
    return !c || state.asiChoice.length === c.count
  })
  // Races offering named variants (e.g. Human Standard/Gifted) must have one picked.
  const raceVariantsComplete = computed(() => !grants.value.raceVariants || !!state.raceVariant)

  // ─── Race extra picks: skills / language / feat (Half-Elf, Variant Human) ───
  function toggleFromList(list, id, limit) {
    const i = list.findIndex((x) => String(x) === String(id))
    if (i >= 0) { list.splice(i, 1); return }
    if (limit && list.length >= limit) return
    list.push(id)
  }
  // Race skill choice: `from` (skill suggest ids) or, when empty, all skills.
  const raceSkillOptions = computed(() => {
    const c = grants.value.raceSkillChoice
    if (!c) return []
    const ids = c.from?.length ? c.from : suggestStore.items(SKILL_SUGGEST).map((s) => s.id)
    return ids.map((id) => ({ id, name: suggestValue(SKILL_SUGGEST, id) || `#${id}` }))
  })
  const raceSkillLimit = computed(() => grants.value.raceSkillChoice?.count || 0)
  function toggleRaceSkill(id) { toggleFromList(state.raceSkillIds, id, raceSkillLimit.value) }
  const raceSkillsComplete = computed(() => !grants.value.raceSkillChoice || state.raceSkillIds.length === raceSkillLimit.value)

  // Race language choice: `from` (language suggest ids) or, when empty, all languages.
  const raceLangOptions = computed(() => {
    const c = grants.value.langChoice
    if (!c) return []
    const ids = c.from?.length ? c.from : suggestStore.items(LANG_SUGGEST).map((s) => s.id)
    return ids.map((id) => ({ id, name: suggestValue(LANG_SUGGEST, id) || `#${id}` }))
  })
  const raceLangLimit = computed(() => grants.value.langChoice?.count || 0)
  function toggleRaceLang(id) { toggleFromList(state.raceLangIds, id, raceLangLimit.value) }
  const raceLangsComplete = computed(() => !grants.value.langChoice || state.raceLangIds.length === raceLangLimit.value)

  // Feat choice (Variant/Gifted Human): pick from handbook feats (type 7).
  const featOptions = computed(() => (grants.value.featChoice ? featPool.value : []))
  const featLimit = computed(() => grants.value.featChoice?.count || 0)
  function toggleFeat(id) { toggleFromList(state.featIds, id, featLimit.value) }
  const featComplete = computed(() => !grants.value.featChoice || state.featIds.length === featLimit.value)

  const pointsSpent = computed(() => STATS.reduce((sum, s) => sum + pointCost(Number(state.scores[s] ?? 8)), 0))
  const pointsLeft = computed(() => POINT_BUY_BUDGET - pointsSpent.value)

  function setMethod(method) {
    state.statMethod = method
    state.scores = emptyScores()
    state.rollPool = []
    if (method === 'pointbuy') STATS.forEach((s) => { state.scores[s] = 8 })
  }

  function rollStats() {
    state.rollPool = Array.from({ length: 6 }, () => roll4d6DropLowest()).sort((a, b) => b - a)
    state.scores = emptyScores()
  }

  async function loadSpells() {
    if (!state.charClass) { spellPool.value = []; return }
    const res = await fetchGet(`/items?typeId=${SPELL_TYPE}&limit=500`)
    const classId = state.charClass.id
    spellPool.value = (res?.items || []).filter((sp) => {
      const lvl = Number(sp.data?.lvl ?? 0)
      if (lvl > 1) return false
      const byItem = (sp.data?.classes || []).some((c) => Number(c?.id) === classId)
      return byItem
    })
  }

  // Level-1 granted features that carry an actionable `choice` (suggest dictionary
  // or named options) — drives the "Выборы" step.
  const level1Features = computed(() => {
    const race = featuresForBinding(raceAbilities.value, { raceId: state.race?.id, subraceId: state.subrace?.id }, 1)
    const cls = featuresForBinding(classAbilities.value, { classId: state.charClass?.id, subclassId: state.subclass?.id }, 1)
    return [...race, ...cls]
  })
  const featureChoices = computed(() => level1Features.value
    .filter((a) => a?.data?.choice && (a.data.choice.from_suggest_id || (a.data.choice.options || []).length))
    .map((a) => ({ id: a.id, name: a.name, choice: a.data.choice })))

  watch(featureChoices, (list) => {
    list.forEach((fc) => { if (fc.choice.from_suggest_id) suggestStore.ensure(Number(fc.choice.from_suggest_id)) })
  }, { immediate: true })

  function choiceOptionList(choice) {
    if (!choice) return []
    if (choice.from_suggest_id) {
      return suggestStore.items(Number(choice.from_suggest_id)).map((it) => ({ value: it.id, label: it.value }))
    }
    return (choice.options || []).map((o) => ({ value: o.label, label: o.label, desc: o.desc }))
  }
  function choiceSelected(abilityId) {
    return state.choices[abilityId] || []
  }
  function toggleChoice(abilityId, value, count) {
    const cur = state.choices[abilityId] || []
    const has = cur.some((v) => String(v) === String(value))
    let next
    if (Number(count) === 1) {
      next = has ? [] : [value]
    } else if (has) {
      next = cur.filter((v) => String(v) !== String(value))
    } else {
      next = cur.length < Number(count) ? [...cur, value] : cur
    }
    state.choices = { ...state.choices, [abilityId]: next }
  }
  const choicesComplete = computed(() => featureChoices.value
    .every((fc) => (state.choices[fc.id] || []).length === (Number(fc.choice.count) || 1)))

  // ─── Derived level-1 stats (live preview) ──────────────────────────────────
  const PROF_BONUS = proficiencyBonus(1)
  const mods = computed(() => Object.fromEntries(STATS.map((s) => [s, abilityModifier(finalScores.value[s] || 10)])))
  const hitDieFace = computed(() => {
    const m = String(suggestValue(11, grants.value.hitDieId)).match(/(\d+)/)
    return m ? Number(m[1]) : null
  })
  const maxHp = computed(() => (hitDieFace.value ? hitDieFace.value + mods.value.CON : null))
  const unarmoredAc = computed(() => 10 + mods.value.DEX)
  const initiativeMod = computed(() => mods.value.DEX)
  const castingAbility = computed(() => grants.value.spellcasting?.stat || null)
  const spellDc = computed(() => (castingAbility.value ? 8 + PROF_BONUS + mods.value[castingAbility.value] : null))
  const spellAtk = computed(() => (castingAbility.value ? PROF_BONUS + mods.value[castingAbility.value] : null))
  const primaryAbilities = computed(() =>
    (state.charClass?.data?.primary_abilities || []).map((id) => STAT_BY_SUGGEST16[Number(id)]).filter(Boolean))

  // ─── Race/class sub-selection requirements ─────────────────────────────────
  const subclassAtCreation = computed(() => (Number(state.charClass?.data?.subclass_level) || 99) <= 1)
  const requiresSubrace = computed(() => subraces.value.length > 0)
  const requiresSubclass = computed(() => subclassAtCreation.value && subclasses.value.length > 0)

  // ─── Skills: owning ability + live modifier ────────────────────────────────
  function skillStat(skillId) { return SKILL_BY_STAT[String(skillId)] || null }
  function skillMod(skillId) {
    const st = skillStat(skillId)
    if (!st) return 0
    return mods.value[st] + (state.skillIds.includes(skillId) ? PROF_BONUS : 0)
  }
  function toggleSkill(id) {
    const i = state.skillIds.indexOf(id)
    if (i >= 0) state.skillIds.splice(i, 1)
    else if (state.skillIds.length < skillLimit.value) state.skillIds.push(id)
  }

  // ─── Spells: cantrips vs 1st-level, each count-limited ─────────────────────
  const cantripPool = computed(() => spellPool.value.filter((sp) => Number(sp.data?.lvl ?? 0) === 0))
  const spell1Pool = computed(() => spellPool.value.filter((sp) => Number(sp.data?.lvl ?? 0) === 1))
  const cantripLimit = computed(() => grants.value.spellcasting?.cantripsKnown || 0)
  const spell1Limit = computed(() => grants.value.spellcasting?.spellsKnown || 0)
  const cantripChosen = computed(() => state.spellIds.filter((id) => cantripPool.value.some((sp) => sp.id === id)).length)
  const spell1Chosen = computed(() => state.spellIds.filter((id) => spell1Pool.value.some((sp) => sp.id === id)).length)
  function toggleSpell(id, kind) {
    const i = state.spellIds.indexOf(id)
    if (i >= 0) { state.spellIds.splice(i, 1); return }
    const chosen = kind === 'cantrip' ? cantripChosen.value : spell1Chosen.value
    const limit = kind === 'cantrip' ? cantripLimit.value : spell1Limit.value
    if (limit && chosen >= limit) return
    state.spellIds.push(id)
  }
  const spellsComplete = computed(() => cantripChosen.value <= cantripLimit.value && spell1Chosen.value <= spell1Limit.value)

  // ─── Convenience actions ───────────────────────────────────────────────────
  function randomName() { state.name = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)] }
  function quickBuild() {
    setMethod('array')
    const order = [...primaryAbilities.value]
    ;['CON', 'DEX', 'WIS', 'STR', 'INT', 'CHA'].forEach((s) => { if (!order.includes(s)) order.push(s) })
    order.slice(0, 6).forEach((s, i) => { state.scores[s] = STANDARD_ARRAY[i] })
  }

  const scoresComplete = computed(() => STATS.every((s) => Number(state.scores[s]) > 0))

  function toSel(item) {
    return item ? { id: item.id, name: item.name, item } : null
  }

  function buildPayload() {
    return buildCharacterData({
      name: state.name.trim(),
      race: toSel(state.race),
      subrace: toSel(state.subrace),
      charClass: toSel(state.charClass),
      subclass: toSel(state.subclass),
      raceVariant: state.raceVariant,
      scores: Object.fromEntries(STATS.map((s) => [s, Number(state.scores[s] ?? 10)])),
      asiChoice: state.asiChoice.slice(),
      raceSkillIds: state.raceSkillIds.slice(),
      raceLangIds: state.raceLangIds.slice(),
      featIds: state.featIds.slice(),
      skillIds: state.skillIds.slice(),
      spellIds: state.spellIds.slice(),
      choices: featureChoices.value.map((fc) => ({
        abilityId: fc.id,
        from_suggest_id: fc.choice.from_suggest_id,
        selected: (state.choices[fc.id] || []).slice(),
      })),
      raceAbilityItems: raceAbilities.value,
      classAbilityItems: classAbilities.value,
      suggestValue,
    })
  }

  // ─── Persistence (localStorage) — survives reload; going back keeps forward picks ─
  const STORAGE_KEY = 'dnd-create-wizard-v1'
  function serialize() {
    const { step, version, name, race, subrace, charClass, subclass, raceVariant, statMethod, scores, rollPool, asiChoice, raceSkillIds, raceLangIds, featIds, skillIds, spellIds, choices } = state
    return { step, version, name, race, subrace, charClass, subclass, raceVariant, statMethod, scores, rollPool, asiChoice, raceSkillIds, raceLangIds, featIds, skillIds, spellIds, choices }
  }
  function persist() {
    if (hydrating) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize())) } catch { /* quota/private mode */ }
  }
  function clearPersist() {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }
  // Start over: wipe every pick back to defaults and drop the saved draft.
  function reset() {
    Object.assign(state, {
      step: 0, version: '2014', name: '', race: null, subrace: null,
      charClass: null, subclass: null, raceVariant: null, statMethod: 'array',
      scores: emptyScores(), rollPool: [], asiChoice: [],
      raceSkillIds: [], raceLangIds: [], featIds: [], skillIds: [], spellIds: [], choices: {},
    })
    spellPool.value = []
    clearPersist()
  }
  async function restore() {
    let saved = null
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { saved = null }
    if (!saved) return
    hydrating = true
    Object.assign(state, saved)
    if (state.race) subraces.value = ((await fetchGet(`/items/children?parentId=${state.race.id}`))?.items || []).filter((i) => i.typeId === RACE_TYPE)
    if (state.charClass) subclasses.value = ((await fetchGet(`/items/children?parentId=${state.charClass.id}`))?.items || []).filter((i) => i.typeId === CLASS_TYPE)
    if (isCaster.value) await loadSpells()
    // Let the reset watchers (guarded by `hydrating`) flush before unlocking, so
    // they can't wipe the restored subrace / variant / floating-ASI picks.
    await nextTick()
    hydrating = false
  }
  watch(state, persist, { deep: true })

  return {
    STATS,
    state,
    races, classes, subraces, subclasses, spellPool, featPool, loading,
    raceAbilities, classAbilities,
    grants, isCaster, skillOptions, skillLimit, finalScores,
    pointsSpent, pointsLeft,
    featureChoices, choiceOptionList, choiceSelected, toggleChoice, choicesComplete,
    suggestValue,
    // derived level-1 stats + preview
    mods, maxHp, unarmoredAc, initiativeMod, spellDc, spellAtk, castingAbility, primaryAbilities,
    // sub-selection gating
    subclassAtCreation, requiresSubrace, requiresSubclass,
    // floating racial ASI + named variants
    toggleAsiChoice, asiChoiceComplete, raceVariantsComplete,
    // race extra picks: skills / language / feat
    raceSkillOptions, raceSkillLimit, toggleRaceSkill, raceSkillsComplete,
    raceLangOptions, raceLangLimit, toggleRaceLang, raceLangsComplete,
    featOptions, featLimit, toggleFeat, featComplete,
    // persistence
    restore, clearPersist, reset,
    // skills
    skillStat, skillMod, toggleSkill,
    // spells
    cantripPool, spell1Pool, cantripLimit, spell1Limit, cantripChosen, spell1Chosen, toggleSpell, spellsComplete,
    // actions
    randomName, quickBuild,
    load, loadSpells, setMethod, rollStats, scoresComplete, buildPayload,
  }
}
