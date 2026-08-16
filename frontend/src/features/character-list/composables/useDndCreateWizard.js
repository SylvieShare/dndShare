import { abilityModifier, proficiencyBonus } from '@/shared/lib/dnd'
import { chosenOptionLabels, grantedSpellsAt } from '@/features/character-editor/blocks/dnd/lib/levelUp'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { SKILL_BY_STAT } from '@/features/character-editor/settings/dnd/creation/buildCharacter'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { extractGrants } from '@/features/character-editor/settings/dnd/creation/grants'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { evaluateFeatEligibility } from '@/features/items/lib/featRules'
import {
  mergeEquipment,
  selectedStartingEquipment,
  startingEquipmentComplete,
  startingEquipmentProfile,
} from '@/features/character-editor/settings/dnd/creation/startingEquipment'
import { useSuggestStore } from '@/stores/suggest'
import { contentScopeQuery, normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'
import { dieSides } from '@/shared/lib/systemDice'
import { randomDndName } from '@/shared/lib/dndNames'
import { buildDndCharacterPayload } from './dndCreateWizardPayload'
import {
  createDndWizardState,
  DND_WIZARD_STORAGE_KEY,
  serializeDndWizardState,
} from './dndCreateWizardState'
import {
  emptyScores, POINT_BUY_BUDGET, pointCost, roll4d6DropLowest, STANDARD_ARRAY, STATS,
} from './dndCreateWizardStats'

export { POINT_BUY_BUDGET, pointCost, STANDARD_ARRAY } from './dndCreateWizardStats'

const RACE_TYPE = 8
const CLASS_TYPE = 9
const RACE_ABIL_TYPE = 3
const CLASS_ABIL_TYPE = 4
const SPELL_TYPE = 5
const FEAT_TYPE = 7
const BG_TYPE = 11
const SKILL_SUGGEST = 15
const LANG_SUGGEST = 6
// Standard player languages (suggest 6) for the background "extra language" picker —
// the full type-6 dict is polluted with monster/telepathy entries, so we curate.
const STANDARD_LANG_IDS = [21, 19, 39, 55, 52, 20, 40, 25, 31, 23, 33, 30, 34, 35, 60]
const STAT_BY_SUGGEST16 = SUGGEST16_TO_STAT

/** Wizard state + data loading + payload assembly for D&D character creation. */
export function useDndCreateWizard() {
  const suggestStore = useSuggestStore()
  ;[3, 4, 5, 6, 7, 15, 16].forEach((t) => suggestStore.ensure(t))

  const races = ref([])
  const classes = ref([])
  const subraces = ref([])
  const subclasses = ref([])
  const raceAbilities = ref([])
  const classAbilities = ref([])
  const spellPool = ref([])
  const featPool = ref([])
  const bgPool = ref([])
  const loading = ref(false)
  const sourceVersionId = ref(null)

  const state = reactive(createDndWizardState())
  // True while restoring from localStorage — suppresses the reset watchers below.
  let hydrating = false
  let loadedOnce = false
  let scopeReloadTimer = null

  function sourceSuffix() {
    return contentScopeQuery(state.contentSources, sourceVersionId.value)
  }

  function setSourceVersionId(id) {
    sourceVersionId.value = id == null ? null : Number(id)
  }

  async function load() {
    loading.value = true
    try {
      const [r, c, ra, ca, ft, bg] = await Promise.all([
        fetchGet(`/items?typeId=${RACE_TYPE}&limit=300${sourceSuffix()}`),
        fetchGet(`/items?typeId=${CLASS_TYPE}&limit=300${sourceSuffix()}`),
        fetchGet(`/items?typeId=${RACE_ABIL_TYPE}&limit=500${sourceSuffix()}`),
        fetchGet(`/items?typeId=${CLASS_ABIL_TYPE}&limit=500${sourceSuffix()}`),
        fetchGet(`/items?typeId=${FEAT_TYPE}&limit=500${sourceSuffix()}`),
        fetchGet(`/items?typeId=${BG_TYPE}&limit=200${sourceSuffix()}`),
      ])
      // Base races/classes only — subraces/subclasses are children (parentId set).
      races.value = (r?.items || []).filter((i) => !i.parentId)
      classes.value = (c?.items || []).filter((i) => !i.parentId)
      raceAbilities.value = ra?.items || []
      classAbilities.value = ca?.items || []
      featPool.value = ft?.items || []
      bgPool.value = bg?.items || []
    } finally {
      loading.value = false
      loadedOnce = true
    }
  }

  watch(
    [sourceVersionId, () => JSON.stringify(normalizeContentSourceSettings(state.contentSources))],
    () => {
      if (hydrating || !loadedOnce) return
      clearTimeout(scopeReloadTimer)
      scopeReloadTimer = setTimeout(() => load(), 120)
    },
  )

  watch(() => state.race, async (r) => {
    if (hydrating) return
    state.subrace = null
    state.raceVariant = null
    subraces.value = []
    if (!r) return
    const raceId = r.id
    const items = ((await fetchGet(`/items/children?parentId=${raceId}${sourceSuffix()}`))?.items || []).filter((i) => i.typeId === RACE_TYPE)
    if (state.race?.id === raceId) subraces.value = items
  })
  watch(() => state.charClass, async (c) => {
    if (hydrating) return
    state.subclass = null
    state.skillIds = []
    state.classEquipmentChoices = {}
    subclasses.value = []
    if (!c) return
    const classId = c.id
    const items = ((await fetchGet(`/items/children?parentId=${classId}${sourceSuffix()}`))?.items || []).filter((i) => i.typeId === CLASS_TYPE)
    if (state.charClass?.id === classId) subclasses.value = items
  })
  // A different race/subrace/variant means a different set of race offers — clear the picks.
  watch(() => [state.race?.id, state.subrace?.id, state.raceVariant], () => {
    if (hydrating) return
    state.asiChoice = []
    state.raceSkillIds = []
    state.raceLangIds = []
    state.featIds = []
    state.featSelections = {}
  })

  function suggestValue(typeId, id) {
    const it = suggestStore.items(typeId).find((s) => String(s.id) === String(id))
    return it?.value || ''
  }

  // Changing background clears its chosen languages.
  watch(() => state.background?.id, () => { if (!hydrating) state.bgLangIds = [] })

  const grants = computed(() => extractGrants({
    race: state.race,
    subrace: state.subrace,
    charClass: state.charClass,
    subclass: state.subclass,
    raceVariant: state.raceVariant,
    background: state.background,
  }))

  const isCaster = computed(() => !!grants.value.spellcasting)

  const skillOptions = computed(() => (grants.value.skillChoice?.from || []).map((id) => ({
    id,
    name: suggestValue(15, id) || `#${id}`,
  })))
  const skillLimit = computed(() => grants.value.skillChoice?.count || 0)

  function racialBonus(s) {
    const fixed = (grants.value.asi || []).filter((a) => a.stat === s).reduce((sum, a) => sum + a.bonus, 0)
    const floating = state.asiChoice.includes(s) ? (grants.value.asiChoice?.bonus || 0) : 0
    return fixed + floating
  }

  // Final ability scores = chosen base + racial ASI (fixed + floating choice).
  const finalScores = computed(() => Object.fromEntries(
    STATS.map((s) => [s, Number(state.scores[s] ?? 0) + racialBonus(s)]),
  ))

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
    const allowedIds = c.from?.length ? c.from : suggestStore.items(LANG_SUGGEST).map((s) => s.id)
    const ids = [...new Set([...allowedIds, ...state.raceLangIds])]
    return ids
      .map((id) => ({ id, name: suggestValue(LANG_SUGGEST, id) }))
      .filter((option) => option.name)
  })
  const raceLangLimit = computed(() => grants.value.langChoice?.count || 0)
  function toggleRaceLang(id) { toggleFromList(state.raceLangIds, id, raceLangLimit.value) }
  const raceLangsComplete = computed(() => !grants.value.langChoice || state.raceLangIds.length === raceLangLimit.value)

  // A handbook update can remove a language referenced by an older saved draft.
  // Once the dictionary is loaded, discard that stale ID instead of showing it as
  // an opaque technical tag such as "#21".
  watch([raceLangOptions, () => suggestStore.loaded(LANG_SUGGEST)], ([options, loaded]) => {
    if (!loaded) return
    const allowed = new Set(options.map((option) => String(option.id)))
    const valid = state.raceLangIds.filter((id) => allowed.has(String(id)))
    if (valid.length !== state.raceLangIds.length) state.raceLangIds = valid
  }, { immediate: true })

  // Feat choice (Variant/Gifted Human): pick from handbook feats (type 7).
  const featOptions = computed(() => (grants.value.featChoice ? featPool.value : []))
  const featLimit = computed(() => grants.value.featChoice?.count || 0)
  function toggleFeat(id) {
    const exists = state.featIds.some((value) => String(value) === String(id))
    toggleFromList(state.featIds, id, featLimit.value)
    if (exists) {
      const next = { ...state.featSelections }
      delete next[id]
      state.featSelections = next
    }
  }
  function setFeatSelection(item, choices = {}) {
    if (!item?.id) return
    if (!state.featIds.some((id) => String(id) === String(item.id))) toggleFeat(item.id)
    state.featSelections = { ...state.featSelections, [item.id]: choices }
  }
  function featEligibility(item) {
    const result = evaluateFeatEligibility(item, {
      stats: finalScores.value,
      level: 1,
      spellcasting: !!grants.value.spellcasting,
      armorProfIds: grants.value.proficiencies?.armor || [],
    })
    const alreadyTaken = state.featIds.some((id) => String(id) === String(item?.id))
    if (alreadyTaken && !item?.data?.repeatable) {
      return { ...result, eligible: false, reasons: [...result.reasons, 'Черта уже выбрана'] }
    }
    return result
  }
  const featComplete = computed(() => !grants.value.featChoice || state.featIds.length === featLimit.value)

  // ─── Background (type 11): fixed skills/tools/languages + a chosen language ──
  const backgroundSkillNames = computed(() => (grants.value.backgroundSkills || []).map((id) => suggestValue(SKILL_SUGGEST, id)).filter(Boolean))
  const backgroundToolNames = computed(() => (state.background?.data?.tool_prof || []).map((id) => suggestValue(5, id)).filter(Boolean))
  const bgLangOptions = computed(() => {
    if (!grants.value.bgLangChoice) return []
    return [...new Set([...STANDARD_LANG_IDS, ...state.bgLangIds])]
      .map((id) => ({ id, name: suggestValue(LANG_SUGGEST, id) }))
      .filter((option) => option.name)
  })
  const bgLangLimit = computed(() => grants.value.bgLangChoice?.count || 0)
  function toggleBgLang(id) { toggleFromList(state.bgLangIds, id, bgLangLimit.value) }
  const bgLangsComplete = computed(() => !grants.value.bgLangChoice || state.bgLangIds.length === bgLangLimit.value)

  // ─── Equipment: PHB class choices + optional handbook additions ────────────
  const classEquipmentProfile = computed(() => startingEquipmentProfile(state.charClass))
  const classEquipmentComplete = computed(() => startingEquipmentComplete(classEquipmentProfile.value, state.classEquipmentChoices))
  const classEquipment = computed(() => selectedStartingEquipment(classEquipmentProfile.value, state.classEquipmentChoices))
  const allEquipment = computed(() => mergeEquipment(classEquipment.value, state.equipment))

  function selectEquipmentOption(groupId, optionId) {
    state.classEquipmentChoices = {
      ...state.classEquipmentChoices,
      [groupId]: { optionId, picks: {} },
    }
  }
  function setEquipmentPick(groupId, optionId, pickId, index, value) {
    const current = state.classEquipmentChoices[groupId]
    const picks = current?.optionId === optionId ? { ...(current.picks || {}) } : {}
    const values = [...(picks[pickId] || [])]
    if (value) values[index] = value
    else values[index] = ''
    picks[pickId] = values
    state.classEquipmentChoices = {
      ...state.classEquipmentChoices,
      [groupId]: { optionId, picks },
    }
  }

  function addEquipment(item, qty = 1) {
    if (!item?.id) return
    const n = Math.max(1, Math.floor(Number(qty) || 1))
    const existing = state.equipment.find((e) => e.id === item.id)
    if (existing) existing.count += n
    else state.equipment.push({ id: item.id, name: item.name, count: n, typeId: item.typeId })
  }
  function removeEquipment(id) {
    const i = state.equipment.findIndex((e) => e.id === id)
    if (i >= 0) state.equipment.splice(i, 1)
  }
  function bumpEquipment(id, delta) {
    const e = state.equipment.find((x) => x.id === id)
    if (!e) return
    e.count = Math.max(1, e.count + delta)
  }

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

  // Spells are chosen on the Class step now, so load them as soon as a caster
  // class/subclass is picked (not when advancing to a separate step).
  watch(() => [state.charClass?.id, state.subclass?.id], () => {
    if (hydrating) return
    if (isCaster.value) loadSpells()
    else spellPool.value = []
  })

  async function loadSpells() {
    if (!state.charClass) { spellPool.value = []; return }
    const res = await fetchGet(`/items?typeId=${SPELL_TYPE}&limit=500${sourceSuffix()}`)
    const classId = state.charClass.id
    spellPool.value = (res?.items || []).filter((sp) => {
      const lvl = Number(sp.data?.lvl ?? 0)
      if (lvl > 1) return false
      const byItem = (sp.data?.classes || []).some((c) => Number(c?.id) === classId)
      return byItem
    })
  }

  // Level-1 granted features that carry an actionable `choice` (suggest dictionary
  // or named options), split by source so each is made on its own step (race
  // choices on the Race step, class choices on the Class step).
  function toChoices(list) {
    return list
      .filter((a) => a?.data?.choice && (a.data.choice.from_suggest_id || (a.data.choice.options || []).length))
      .map((a) => ({ id: a.id, name: a.name, choice: a.data.choice }))
  }
  const raceFeatureChoices = computed(() => toChoices(featuresForBinding(raceAbilities.value, { raceId: state.race?.id, subraceId: state.subrace?.id }, 1)))
  const classFeatureChoices = computed(() => toChoices(featuresForBinding(classAbilities.value, { classId: state.charClass?.id, subclassId: state.subclass?.id }, 1)))
  const featureChoices = computed(() => [...raceFeatureChoices.value, ...classFeatureChoices.value])
  const isChoiceComplete = (fc) => (state.choices[fc.id] || []).length === (Number(fc.choice.count) || 1)
  const raceChoicesComplete = computed(() => raceFeatureChoices.value.every(isChoiceComplete))
  const classChoicesComplete = computed(() => classFeatureChoices.value.every(isChoiceComplete))

  watch(featureChoices, (list) => {
    list.forEach((fc) => { if (fc.choice.from_suggest_id) suggestStore.ensure(Number(fc.choice.from_suggest_id)) })
  }, { immediate: true })

  function isExpertiseChoice(fc) {
    return Number(fc?.choice?.from_suggest_id) === SKILL_SUGGEST && /компетентност/i.test(fc?.name || '')
  }
  const proficientSkillIds = computed(() => {
    const ids = [
      ...state.skillIds,
      ...state.raceSkillIds,
      ...(grants.value.backgroundSkills || []),
    ]
    featureChoices.value
      .filter((fc) => Number(fc.choice.from_suggest_id) === SKILL_SUGGEST && !isExpertiseChoice(fc))
      .forEach((fc) => ids.push(...(state.choices[fc.id] || [])))
    return [...new Set(ids.map(String))]
  })
  function choiceOptionList(fcOrChoice) {
    const fc = fcOrChoice?.choice ? fcOrChoice : null
    const choice = fc?.choice || fcOrChoice
    if (!choice) return []
    if (choice.from_suggest_id) {
      let items = suggestStore.items(Number(choice.from_suggest_id))
      if (isExpertiseChoice(fc)) {
        const allowed = new Set(proficientSkillIds.value)
        items = items.filter((it) => allowed.has(String(it.id)))
      }
      return items.map((it) => ({ value: it.id, label: it.value }))
    }
    return (choice.options || []).map((o) => ({ value: o.label, label: o.label, desc: o.desc }))
  }
  function choiceSelected(abilityId) {
    return state.choices[abilityId] || []
  }
  function toggleChoice(abilityId, value, count) {
    const fc = featureChoices.value.find((item) => item.id === abilityId)
    if (isExpertiseChoice(fc) && !proficientSkillIds.value.includes(String(value))) return
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
  watch(proficientSkillIds, (ids) => {
    const allowed = new Set(ids)
    const next = { ...state.choices }
    let changed = false
    featureChoices.value.filter(isExpertiseChoice).forEach((fc) => {
      const selected = next[fc.id] || []
      const valid = selected.filter((id) => allowed.has(String(id)))
      if (valid.length !== selected.length) { next[fc.id] = valid; changed = true }
    })
    if (changed) state.choices = next
  })
  const choicesComplete = computed(() => featureChoices.value
    .every((fc) => (state.choices[fc.id] || []).length === (Number(fc.choice.count) || 1)))

  // ─── Derived level-1 stats (live preview) ──────────────────────────────────
  const PROF_BONUS = proficiencyBonus(1)
  const mods = computed(() => Object.fromEntries(STATS.map((s) => {
    const base = Number(state.scores[s] ?? 0)
    return [s, abilityModifier((base > 0 ? base : 10) + racialBonus(s))]
  })))
  const hitDieFace = computed(() => dieSides(grants.value.hitDieId))
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

  // ─── Даруемые заклинания архетипа (домен жреца на 1 уровне) ────────────────
  const grantedSpellIds = computed(() => [...new Set(grantedSpellsAt(
    [state.charClass, state.subclass].filter(Boolean),
    1,
    { options: chosenOptionLabels(state.choices) },
  ).map((r) => r.spellId))])
  const grantedSpellNames = ref({})
  watch(grantedSpellIds, async (ids) => {
    const missing = ids.filter((id) => !grantedSpellNames.value[id])
    if (!missing.length) return
    const res = await fetchGet('/items/by-ids?ids=' + missing.join(','))
    const next = { ...grantedSpellNames.value }
    ;(res?.items || []).forEach((it) => { next[it.id] = it.name })
    grantedSpellNames.value = next
  }, { immediate: true })
  const grantedSpellList = computed(() => grantedSpellIds.value.map((id) => ({ id, name: grantedSpellNames.value[id] || `#${id}` })))

  // ─── Convenience actions ───────────────────────────────────────────────────
  function randomName() {
    state.name = randomDndName(state.subrace || state.race, Math.random, state.name)
  }
  function quickBuild() {
    setMethod('array')
    const order = [...primaryAbilities.value]
    ;['CON', 'DEX', 'WIS', 'STR', 'INT', 'CHA'].forEach((s) => { if (!order.includes(s)) order.push(s) })
    order.slice(0, 6).forEach((s, i) => { state.scores[s] = STANDARD_ARRAY[i] })
  }

  const scoresComplete = computed(() => STATS.every((s) => Number(state.scores[s]) > 0))

  function buildPayload() {
    return buildDndCharacterPayload({
      state,
      stats: STATS,
      featPool: featPool.value,
      equipment: allEquipment.value,
      grantedSpellIds: grantedSpellIds.value,
      featureChoices: featureChoices.value,
      raceAbilities: raceAbilities.value,
      classAbilities: classAbilities.value,
      suggestValue,
      isExpertiseChoice,
    })
  }

  // ─── Persistence (localStorage) — survives reload; going back keeps forward picks ─
  function persist() {
    if (hydrating) return
    try { localStorage.setItem(DND_WIZARD_STORAGE_KEY, JSON.stringify(serializeDndWizardState(state))) } catch { /* quota/private mode */ }
  }
  function clearPersist() {
    try { localStorage.removeItem(DND_WIZARD_STORAGE_KEY) } catch { /* ignore */ }
  }
  // Start over: wipe every pick back to defaults and drop the saved draft.
  function reset() {
    Object.assign(state, createDndWizardState())
    spellPool.value = []
    clearPersist()
  }
  async function restore() {
    let saved = null
    try { saved = JSON.parse(localStorage.getItem(DND_WIZARD_STORAGE_KEY) || 'null') } catch { saved = null }
    if (!saved) return
    hydrating = true
    Object.assign(state, saved)
    state.contentSources = normalizeContentSourceSettings(state.contentSources)
    if (state.race) subraces.value = ((await fetchGet(`/items/children?parentId=${state.race.id}${sourceSuffix()}`))?.items || []).filter((i) => i.typeId === RACE_TYPE)
    if (state.charClass) subclasses.value = ((await fetchGet(`/items/children?parentId=${state.charClass.id}${sourceSuffix()}`))?.items || []).filter((i) => i.typeId === CLASS_TYPE)
    if (isCaster.value) await loadSpells()
    // Let the reset watchers (guarded by `hydrating`) flush before unlocking, so
    // they can't wipe the restored subrace / variant / floating-ASI picks.
    await nextTick()
    hydrating = false
  }
  watch(state, persist, { deep: true })

  return {
    STATS,
    state, sourceVersionId, setSourceVersionId,
    races, classes, subraces, subclasses, spellPool, featPool, bgPool, loading,
    raceAbilities, classAbilities,
    grants, isCaster, skillOptions, skillLimit, finalScores, racialBonus,
    pointsSpent, pointsLeft,
    featureChoices, raceFeatureChoices, classFeatureChoices,
    choiceOptionList, choiceSelected, toggleChoice, choicesComplete,
    raceChoicesComplete, classChoicesComplete,
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
    featOptions, featLimit, toggleFeat, setFeatSelection, featEligibility, featComplete,
    // background + equipment
    backgroundSkillNames, backgroundToolNames, bgLangOptions, bgLangLimit, toggleBgLang, bgLangsComplete,
    classEquipmentProfile, classEquipmentComplete, classEquipment, allEquipment,
    selectEquipmentOption, setEquipmentPick,
    addEquipment, removeEquipment, bumpEquipment,
    // persistence
    restore, clearPersist, reset,
    // skills
    skillStat, skillMod, toggleSkill,
    // spells
    cantripPool, spell1Pool, cantripLimit, spell1Limit, cantripChosen, spell1Chosen, toggleSpell, spellsComplete,
    grantedSpellList,
    // actions
    randomName, quickBuild,
    load, loadSpells, setMethod, rollStats, scoresComplete, buildPayload,
  }
}
