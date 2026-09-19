import { useDndCreateAbilitySelections } from './useDndCreateAbilitySelections'
import { useDndOrigin } from './useDndOrigin'
import { useDndCreateSpells } from './useDndCreateSpells'
import { useDndCreateCatalog } from './useDndCreateCatalog'
import { usePersistedDraft } from '@/shared/composables/usePersistedDraft'
import { abilityModifier, proficiencyBonus } from '@/shared/lib/dnd'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { SKILL_BY_STAT } from '@/features/character-editor/settings/dnd/creation/buildCharacter'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { extractGrants } from '@/features/character-editor/settings/dnd/creation/grants'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { evaluateFeatEligibility, featAbilityBonuses } from '@/features/items/lib/featRules'
import { itemChoiceRows, itemMatchesChoiceFilter } from '@/features/items/lib/itemChoices'
import { useSuggestStore } from '@/stores/suggest'
import { contentScopeQuery, normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'
import { itemsApi } from '@/shared/api/itemsApi'
import { dieSides } from '@/shared/lib/systemDice'
import { randomDndName } from '@/shared/lib/dndNames'
import {
  originChildren,
} from '@/shared/lib/dndItemTypes'
import { useDndCreateBackground } from './useDndCreateBackground'
import { buildDndCharacterPayload } from './dndCreateWizardPayload'
import { liveSkillModifier } from '@/features/character-list/components/wizard/previewSkills'
import { useDndCreateEquipment } from './useDndCreateEquipment'
import {
  createDndWizardState,
  DND_WIZARD_STORAGE_KEY,
  normalizeDndWizardDraft,
  serializeDndWizardState,
} from './dndCreateWizardState'
import {
  emptyScores, POINT_BUY_BUDGET, pointCost, roll4d6Series, STANDARD_ARRAY, STATS,
} from './dndCreateWizardStats'

export { POINT_BUY_BUDGET, pointCost, STANDARD_ARRAY } from './dndCreateWizardStats'
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

  const state = reactive(createDndWizardState())
  // True while restoring from localStorage — suppresses the reset watchers below.
  let hydrating = false
  const sourceVersionId = ref(null)
  function sourceSuffix() {
    return contentScopeQuery({ ...state.contentSources, allowLegacy: false }, sourceVersionId.value)
  }

  function setSourceVersionId(id) {
    sourceVersionId.value = id == null ? null : Number(id)
  }

  const equipment = useDndCreateEquipment({ state, sourceSuffix })

  const {
    races, allSubraces, classes, allSubclasses, subraces, subclasses,
    raceAbilities, classAbilities, spellPool, featPool, bgPool, loading,
    load, loadSpells, raceSubraceNames, classSubclassNames,
  } = useDndCreateCatalog({ state, sourceVersionId, sourceSuffix, equipment, paused: () => hydrating })

  const abilitySelections = useDndCreateAbilitySelections(state, classAbilities, () => hydrating)
  const origin = useDndOrigin(state, featPool)
  watch(() => state.version, () => { if (!hydrating) { state.race = null; state.subrace = null; state.charClass = null; state.subclass = null; state.background = null; state.backgroundAsi = {}; state.originFeatId = null; state.originFeatChoices = {}; state.backgroundTakeGold = false } })

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

  const {
    backgroundItemChoiceProfile, activeBackgroundItemChoices, backgroundItemChoicesComplete,
    selectedBackgroundToolProficiencies, setBackgroundItemChoice, backgroundStart, backgroundToolItems,
  } = useDndCreateBackground(state, equipment, () => hydrating)

  const grants = computed(() => extractGrants({
    rulesVersion: state.version,
    race: state.race,
    subrace: state.subrace,
    charClass: state.charClass,
    subclass: state.subclass,
    raceVariant: state.raceVariant,
    background: state.background,
    classToolProficiencyIds: state.classToolProficiencyIds,
    backgroundToolProficiencies: selectedBackgroundToolProficiencies.value,
  }))

  const isCaster = computed(() => !!grants.value.spellcasting)

  const skillOptions = computed(() => (grants.value.skillChoice?.from || []).map((id) => ({
    id,
    name: suggestValue(15, id) || `#${id}`,
    desc: suggestStore.items(SKILL_SUGGEST).find(item => String(item.id) === String(id))?.desc || '',
  })))
  const skillLimit = computed(() => grants.value.skillChoice?.count || 0)
  const classToolProficiencyOptions = computed(() => {
    const choice = grants.value.toolProficiencyChoice
    if (!choice) return []
    const allowed = new Set((choice.from || []).map(String))
    return suggestStore.items(5)
      .filter((item) => allowed.has(String(item.id)))
      .map((item) => ({ id: item.id, name: item.value, desc: item.desc || '' }))
  })
  const classToolProficiencyLimit = computed(() => grants.value.toolProficiencyChoice?.count || 0)
  const classToolProficienciesComplete = computed(() => {
    if (!grants.value.toolProficiencyChoice) return true
    const allowed = new Set(classToolProficiencyOptions.value.map((option) => String(option.id)))
    const selected = new Set(state.classToolProficiencyIds.map(String))
    return selected.size === classToolProficiencyLimit.value
      && [...selected].every((id) => allowed.has(id))
  })
  function toggleClassToolProficiency(id) {
    toggleFromList(state.classToolProficiencyIds, id, classToolProficiencyLimit.value)
  }

  function racialBonus(s) {
    if (origin.originRules.value.backgroundAbilityScores) return (origin.originBonuses.value || []).find(row => row.stat === s)?.bonus || 0
    const fixed = (grants.value.asi || []).filter((a) => a.stat === s).reduce((sum, a) => sum + a.bonus, 0)
    const floating = state.asiChoice.includes(s) ? (grants.value.asiChoice?.bonus || 0) : 0
    return fixed + floating
  }

  // Final ability scores = chosen base + racial ASI (fixed + floating choice).
  const featBonuses = computed(() => {
    const totals = Object.fromEntries(STATS.map(stat => [stat, 0]))
    for (const id of state.featIds) {
      const item = featPool.value.find(feat => String(feat.id) === String(id))
      if (!item) continue
      for (const bonus of featAbilityBonuses(item, state.featSelections?.[id] || {})) totals[bonus.stat] += bonus.bonus
    }
    return totals
  })
  const finalScores = computed(() => Object.fromEntries(
    STATS.map((s) => [s, Number(state.scores[s] ?? 0) + racialBonus(s) + featBonuses.value[s]]),
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
    return ids.map((id) => ({
      id,
      name: suggestValue(SKILL_SUGGEST, id) || `#${id}`,
      desc: suggestStore.items(SKILL_SUGGEST).find(item => String(item.id) === String(id))?.desc || '',
    }))
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
      category: state.version === '2024' ? 'origin' : null,
      stats: finalScores.value,
      level: 1,
      spellcasting: !!grants.value.spellcasting,
      armorProfIds: grants.value.proficiencies?.armor || [],
    })
    const alreadyTaken = state.featIds.some((id) => String(id) === String(item?.id)) || (state.version === '2024' && Number(origin.originFeat.value?.id) === Number(item?.id))
    if (alreadyTaken && !item?.data?.repeatable) {
      return { ...result, eligible: false, reasons: [...result.reasons, 'Черта уже выбрана'] }
    }
    return result
  }
  const featComplete = computed(() => !grants.value.featChoice || state.featIds.length === featLimit.value)

  // ─── Background (type 11): fixed skills/tools/languages + a chosen language ──
  const backgroundSkillNames = computed(() => (grants.value.backgroundSkills || []).map((id) => suggestValue(SKILL_SUGGEST, id)).filter(Boolean))
  const bgLangOptions = computed(() => {
    if (!grants.value.bgLangChoice) return []
    return [...new Set([...STANDARD_LANG_IDS, ...state.bgLangIds])]
      .map((id) => ({ id, name: suggestValue(LANG_SUGGEST, id) }))
      .filter((option) => option.name)
  })
  const bgLangLimit = computed(() => grants.value.bgLangChoice?.count || 0)
  function toggleBgLang(id) { toggleFromList(state.bgLangIds, id, bgLangLimit.value) }
  const bgLangsComplete = computed(() => !grants.value.bgLangChoice || state.bgLangIds.length === bgLangLimit.value)

  const pointsSpent = computed(() => STATS.reduce((sum, s) => sum + pointCost(Number(state.scores[s] ?? 8)), 0))
  const pointsLeft = computed(() => POINT_BUY_BUDGET - pointsSpent.value)

  function setMethod(method) {
    state.statMethod = method
    state.scores = emptyScores()
    if (method === 'pointbuy') STATS.forEach((s) => { state.scores[s] = 8 })
  }

  function rollStats() {
    state.rollSeries = Array.from({ length: 6 }, () => roll4d6Series()).sort((a, b) => b.total - a.total)
    state.rollPool = state.rollSeries.map(series => series.total)
    state.scores = emptyScores()
  }

  // Spells are chosen on the Class step now, so load them as soon as a caster
  // class/subclass is picked (not when advancing to a separate step).
  watch(() => [state.charClass?.id, state.subclass?.id], () => {
    if (hydrating) return
    if (isCaster.value) loadSpells()
    else spellPool.value = []
  })

  const featureChoiceItemOptions = reactive({})

  // Level-1 granted features that carry one or more shared item choices, split
  // by source so each is made on its own step (race choices on the Race step,
  // class choices on the Class step).
  function toChoices(list) {
    return list.flatMap(itemChoiceRows)
  }
  const raceFeatureChoices = computed(() => toChoices(featuresForBinding(raceAbilities.value, { raceId: state.race?.id, subraceId: state.subrace?.id }, 1)))
  const classFeatureChoices = computed(() => toChoices(featuresForBinding(classAbilities.value, { classId: state.charClass?.id, subclassId: state.subclass?.id }, 1)))
  const featureChoices = computed(() => [...raceFeatureChoices.value, ...classFeatureChoices.value])
  const isChoiceComplete = (fc) => (state.choices[fc.id] || []).length === (Number(fc.choice.count) || 1)
  const raceChoicesComplete = computed(() => raceFeatureChoices.value.every(isChoiceComplete))
  const classChoicesComplete = computed(() => abilitySelections.abilitySelectionsComplete.value && classFeatureChoices.value.every(isChoiceComplete))

  watch(featureChoices, (list) => {
    list.forEach(async (fc) => {
      if (fc.choice.from_suggest_id != null) suggestStore.ensure(Number(fc.choice.from_suggest_id))
      for (const source of (fc.choice.suggest_sources || [])) suggestStore.ensure(Number(source.suggest_id))
      if (fc.choice.source !== 'item' || fc.choice.from_item_type_id == null || featureChoiceItemOptions[fc.id]) return
      try {
        const response = await itemsApi.listAll(Number(fc.choice.from_item_type_id), {
          contentSources: state.contentSources,
          sourceVersionId: sourceVersionId.value,
        })
        featureChoiceItemOptions[fc.id] = (response?.items || [])
          .filter((item) => itemMatchesChoiceFilter(item, fc.choice.item_filter))
          .map((item) => ({
            value: item.id,
            label: item.name,
            desc: item.data?.description || item.data?.desc || '',
            item,
          }))
      } catch {
        featureChoiceItemOptions[fc.id] = []
      }
    })
  }, { immediate: true })

  function isExpertiseChoice(fc) {
    return !!fc?.choice?.requires_proficiency && Number(fc?.choice?.exclude_rank) >= 2
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
  const expertiseSkillIds = computed(() => featureChoices.value
    .filter(isExpertiseChoice)
    .flatMap((fc) => state.choices[fc.id] || [])
    .map((value) => String(value).replace(/^skill:/, '')))
  const proficientToolIds = computed(() => [...new Set([
    ...(grants.value.proficiencies?.tool || []),
    ...state.classToolProficiencyIds,
  ].map(String))])
  function choiceValueAllowed(fc, value) {
    if (!fc?.choice?.requires_proficiency) return true
    const raw = String(value)
    if (raw.startsWith('skill:')) return proficientSkillIds.value.includes(raw.slice(6))
    if (raw.startsWith('tool:')) return proficientToolIds.value.includes(raw.slice(5))
    return proficientSkillIds.value.includes(raw)
  }
  function choiceOptionList(fcOrChoice) {
    const fc = fcOrChoice?.choice ? fcOrChoice : null
    const choice = fc?.choice || fcOrChoice
    if (!choice) return []
    if (choice.source === 'item') return featureChoiceItemOptions[fc?.id] || []
    if (choice.source === 'suggest_union') {
      return (choice.suggest_sources || []).flatMap((source) => (
        suggestStore.items(Number(source.suggest_id)) || []
      ).map((item) => ({
        value: `${source.prefix}:${item.id}`,
        label: item.value,
        desc: source.label || item.desc || '',
      }))).filter((option) => choiceValueAllowed(fc, option.value))
    }
    if (choice.from_suggest_id != null) {
      let items = suggestStore.items(Number(choice.from_suggest_id))
      if (isExpertiseChoice(fc)) {
        const allowed = new Set(proficientSkillIds.value)
        items = items.filter((it) => allowed.has(String(it.id)))
      }
      return items.map((it) => ({ value: it.id, label: it.value, desc: it.desc || '' }))
    }
    return (choice.options || []).map((o) => ({
      value: o.value ?? o.label,
      label: o.label || o.value,
      desc: o.desc || '',
    })).filter((option) => option.value != null && option.value !== '')
  }
  function choiceSelected(abilityId) {
    return state.choices[abilityId] || []
  }
  function toggleChoice(abilityId, value, count) {
    const fc = featureChoices.value.find((item) => item.id === abilityId)
    if (!choiceValueAllowed(fc, value)) return
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
  watch([proficientSkillIds, proficientToolIds], () => {
    const next = { ...state.choices }
    let changed = false
    featureChoices.value.filter(isExpertiseChoice).forEach((fc) => {
      const selected = next[fc.id] || []
      const valid = selected.filter((value) => choiceValueAllowed(fc, value))
      if (valid.length !== selected.length) { next[fc.id] = valid; changed = true }
    })
    if (changed) state.choices = next
  })
  const choicesComplete = computed(() => featureChoices.value
    .every((fc) => (state.choices[fc.id] || []).length === (Number(fc.choice.count) || 1)))

  // ─── Derived level-1 stats for step details and sheet preview ────────────
  const PROF_BONUS = proficiencyBonus(1)
  const mods = computed(() => Object.fromEntries(STATS.map((s) => {
    const base = Number(state.scores[s] ?? 0)
    return [s, abilityModifier((base > 0 ? base : 10) + racialBonus(s) + featBonuses.value[s])]
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
    return liveSkillModifier({
      abilityMod: mods.value[st],
      proficiencyBonus: PROF_BONUS,
      skillId,
      proficiencyIds: proficientSkillIds.value,
      expertiseIds: expertiseSkillIds.value,
    })
  }
  function toggleSkill(id) {
    const i = state.skillIds.indexOf(id)
    if (i >= 0) state.skillIds.splice(i, 1)
    else if (state.skillIds.length < skillLimit.value) state.skillIds.push(id)
  }

  const {
    cantripPool, spell1Pool, cantripLimit, spell1Limit, cantripChosen, spell1Chosen,
    toggleSpell, spellsComplete, grantedSpellList,
  } = useDndCreateSpells({ state, spellPool, grants })

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
      spellPool: spellPool.value,
      grantedSpellList: grantedSpellList.value,
      featPool: featPool.value,
      equipment: equipment.allEquipment.value,
      backgroundEquipment: backgroundStart.value,
      backgroundToolProficiencies: selectedBackgroundToolProficiencies.value,
      buyStartingEquipment: state.buyStartingEquipment,
      startingWallet: equipment.shopWallet.value,
      grantedSpellIds: grantedSpellIds.value,
      featureChoices: featureChoices.value,
      raceAbilities: raceAbilities.value,
      classAbilities: classAbilities.value,
      suggestValue,
      isExpertiseChoice,
    })
  }

  // ─── Persistence (localStorage) — survives reload; going back keeps forward picks ─
  const { clear: clearPersist } = usePersistedDraft(state, {
    key: DND_WIZARD_STORAGE_KEY, serialize: serializeDndWizardState, paused: () => hydrating,
  })
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
    saved = normalizeDndWizardDraft(saved)
    hydrating = true
    Object.assign(state, saved)
    state.contentSources = normalizeContentSourceSettings(state.contentSources)
    if (state.race) subraces.value = originChildren(state.race, allSubraces.value, 'subraces')
    if (state.charClass) subclasses.value = originChildren(state.charClass, allSubclasses.value, 'subclasses')
    if (isCaster.value) await loadSpells()
    // Let the reset watchers (guarded by `hydrating`) flush before unlocking, so
    // they can't wipe the restored subrace / variant / floating-ASI picks.
    await nextTick()
    hydrating = false
  }

  return {
    STATS, ...origin, ...abilitySelections,
    state, sourceVersionId, setSourceVersionId,
    races, classes, subraces, subclasses, spellPool, featPool, bgPool, loading,
    raceSubraceNames,
    raceAbilities, classAbilities, classSubclassNames,
    grants, isCaster, skillOptions, skillLimit, finalScores, racialBonus, featBonuses,
    classToolProficiencyOptions, classToolProficiencyLimit,
    classToolProficienciesComplete, toggleClassToolProficiency,
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
    backgroundSkillNames, backgroundStart, backgroundToolItems,
    backgroundItemChoiceProfile, activeBackgroundItemChoices, backgroundItemChoicesComplete,
    setBackgroundItemChoice,
    bgLangOptions, bgLangLimit, toggleBgLang, bgLangsComplete,
    ...equipment,
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
