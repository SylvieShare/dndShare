import { ABILITY_VALUE_IDS } from '@/shared/lib/abilityTypes'

import { computed, inject, onMounted, reactive, ref } from 'vue'
import { proficiencyBonus, resolveNumValue } from '@/shared/lib/dnd'
import { STAT_KEYS, STAT_SHORT } from '@/shared/lib/dndStats'
import {
  chosenOptionLabels, classEntriesOf,
  dieFaceOf, grantedSpellsAt, multiclassCheck,
  MULTICLASS_PROFICIENCY_CHOICES, MULTICLASS_PROFICIENCY_GRANTS,
  multiclassProficiencyKey, parseAsiLevels, totalLevel,
} from '@/features/character-editor/blocks/dnd/lib/levelUp'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { fetchGet } from '@/shared/api/http'
import { itemsApi } from '@/shared/api/itemsApi'
import { contentScopeQuery } from '@/shared/api/contentSourcesApi'
import {
  CLASS_ITEM_TYPE,
  SUBCLASS_ITEM_TYPE,
  originFilterQuery,
} from '@/shared/lib/dndItemTypes'
import { useLevelUpHitPoints } from './useLevelUpHitPoints'
import { useSuggestStore } from '@/stores/suggest'
import { dieLabel } from '@/shared/lib/systemDice'
import { useLevelUpFeatureChoices } from './useLevelUpFeatureChoices'
import { buildLevelUpUpdates } from './buildLevelUpUpdates'
import { useLevelUpFeatSelection } from './useLevelUpFeatSelection'
import { useLevelUpTarget } from './useLevelUpTarget'
import { useLevelUpMagic } from './useLevelUpMagic'
import { useLevelUpAbilitySelections } from './useLevelUpAbilitySelections'
import { useGrantedSpellNames } from './useGrantedSpellNames'
import { hitDieLabel as resolveHitDieLabel, multiclassPrerequisiteLabel } from './levelUpPresentation'
import { levelUpSessionAdditions } from '@/features/character-editor/blocks/dnd/lib/levelUpSessionAdditions'
import { itemMatchesChoiceFilter, parseItemChoiceFilter } from '@/features/items/lib/itemChoices'
import { characterChoiceOptionEligibility } from '@/features/items/lib/characterChoiceEligibility'

const CLASS_ABIL_TYPE = 4
const STATS = STAT_KEYS

export function useDndLevelUp(props, emit) {

  const suggestStore = useSuggestStore()
  const charCtx = inject('charCtx', {})
  const sourceSuffix = () => contentScopeQuery(charCtx.contentSources, charCtx.sourceVersionId)
  ;[3, 4, 5, 6, 15, 16].forEach((typeId) => suggestStore.ensure(typeId))

  const loading = ref(true)
  const saving = ref(false)
  const saveError = ref('')
  const step = ref('pick')
  const entries = ref(classEntriesOf(props.values))
  const itemsById = ref({})
  const abilityPool = ref([])
  const baseClasses = ref([])
  const subclassOptions = ref([])
  const subclassPick = ref(null)
  const asiMode = ref('+2')
  const asiStats = ref([])
  const asiSkipped = ref(false)
  const viewFeature = ref(null)
  const featureItemChoice = ref(null)
  const featureChoiceItemNames = ref({})
  const classSpellSelection = ref(null)

  const {
    target,
    isPlain,
    isNew,
    targetEntry,
    classItem,
    newClassLevel,
    effectiveSubclass,
    needSubclass,
    newClassOptions,
  } = useLevelUpTarget({ entries, itemsById, baseClasses, subclassOptions, subclassPick })

  const total = computed(() => Math.max(totalLevel(entries.value), parseInt(props.values?.lvl?.level) || 1))
  // Первый класс на пустом листе — это не рост уровня, а становление 1-м уровнем.
  const newTotal = computed(() => (isNew.value && !entries.value.length
    ? Math.max(1, total.value)
    : Math.min(20, total.value + 1)))

  // ─── фичи нового уровня ─────────────────────────────────────────────────────
  function isSubclassBound(item) {
    const d = item?.data || {}
    return Array.isArray(d.subclass_ids) && d.subclass_ids.length > 0
  }
  const features = computed(() => {
    if (isPlain.value || !classItem.value) return []
    const binding = { classId: classItem.value.id, subclassId: effectiveSubclass.value?.id }
    if (isNew.value) return featuresForBinding(abilityPool.value, binding, 1)
    const exact = featuresForBinding(abilityPool.value, binding, newClassLevel.value, { cumulative: false })
    if (subclassPick.value) {
      // Архетип выбран прямо сейчас — добираем все его умения до текущего уровня.
      const sub = featuresForBinding(abilityPool.value, binding, newClassLevel.value).filter(isSubclassBound)
      const seen = new Set(exact.map((f) => f.id))
      return [...exact, ...sub.filter((f) => !seen.has(f.id))]
    }
    return exact
  })

  const {
    featureChoices: featChoices,
    selections: featureChoiceSel,
    choiceCount,
    choiceOptions,
    selected: choiceSel,
    choiceLocked,
    toggleChoice: toggleFeatureChoice,
    choiceComplete: choiceCompleteFor,
    complete: featureChoicesComplete,
  } = useLevelUpFeatureChoices(features, suggestStore, (_feature, choice, value) => (
    characterChoiceOptionEligibility(choice, value, {
      values: props.values,
      items: [...abilityPool.value, ...Object.values(itemsById.value)],
      suggestItems: (typeId) => suggestStore.items(typeId),
    })
  ))

  function featureChoiceItemEligibility(item) {
    const matches = itemMatchesChoiceFilter(item, featureItemChoice.value?.choice?.item_filter)
    return { eligible: matches, reasons: matches ? [] : ['Не подходит под фильтр выбора'] }
  }
  const featureChoiceItemFilters = computed(() => parseItemChoiceFilter(featureItemChoice.value?.choice?.item_filter) || {})
  function onFeatureChoiceItemPick(item) {
    const target = featureItemChoice.value
    if (!target) return
    const selectedBefore = choiceSel(target.feature, target.choice).length
    featureChoiceItemNames.value = { ...featureChoiceItemNames.value, [item.id]: item.name }
    toggleFeatureChoice(target.feature, target.choice, item.id)
    if (selectedBefore + 1 >= choiceCount(target.feature, target.choice)) {
      featureItemChoice.value = null
    }
  }

  // ─── даруемые заклинания (домен/клятва/круг) ────────────────────────────────
  const effectiveSubclassItem = computed(() => (subclassPick.value
    ? subclassPick.value
    : (targetEntry.value?.subclass ? itemsById.value[targetEntry.value.subclass.id] : null)))
  const grantedRows = computed(() => {
    if (isPlain.value || !classItem.value) return []
    const items = [classItem.value, effectiveSubclassItem.value].filter(Boolean)
    const options = chosenOptionLabels(props.values?.feature_choices, featureChoiceSel.value)
    if (isNew.value) return grantedSpellsAt(items, 1, { options })
    // Только что выбранный архетип отдаёт весь накопленный список, иначе — дельту уровня.
    if (subclassPick.value) return grantedSpellsAt(items, newClassLevel.value, { options })
    return grantedSpellsAt(items, newClassLevel.value, { exact: true, options })
  })
  const grantedNewIds = computed(() => {
    const sourceId = effectiveSubclassItem.value?.id ?? classItem.value?.id ?? ''
    const have = new Set((props.values?.spells?.grants || []).map((entry) => entry.key))
    return [...new Set(grantedRows.value.map((r) => r.spellId))]
      .filter((id) => !have.has(`class:${sourceId}:spell:${id}`))
  })
  const { spellNames, grantedSpellList } = useGrantedSpellNames(grantedNewIds)

  // ─── хиты ───────────────────────────────────────────────────────────────────
  const hitDieLabelOf = (item) => resolveHitDieLabel(item, dieLabel)
  const hitDieLabel = computed(() => hitDieLabelOf(classItem.value))
  const hitDieFace = computed(() => dieFaceOf(hitDieLabel.value) || 8)
  function statScore(s) {
    const v = props.values?.[s]
    const raw = v && typeof v === 'object' ? v.value : v
    return raw == null ? 10 : resolveNumValue(raw)
  }
  const hp = useLevelUpHitPoints({ hitDieFace, statScore })
  const { hpMode, hpRoll, hpManual, hpGain, hpReady } = hp

  // ─── ASI ────────────────────────────────────────────────────────────────────
  const asiNow = computed(() => !isPlain.value && !isNew.value && classItem.value
    && parseAsiLevels(classItem.value.data?.asi_levels).includes(newClassLevel.value))
  const asiModes = [
    { value: '+2', label: '+2 к одной' },
    { value: '+1+1', label: '+1 к двум' },
    { value: 'feat', label: 'Черта' },
  ]
  const asiDelta = computed(() => (asiMode.value === '+2' ? 2 : 1))
  const asiLimit = computed(() => (asiMode.value === '+2' ? 1 : 2))
  function setAsiMode(m) { asiMode.value = m; asiStats.value = []; featPick.value = null; featConfigItem.value = null }
  function asiChipLocked(s) {
    if (asiStats.value.includes(s)) return false
    if (asiStats.value.length >= asiLimit.value) return true
    return statScore(s) + asiDelta.value > 20
  }
  function toggleAsiStat(s) {
    const i = asiStats.value.indexOf(s)
    if (i >= 0) { asiStats.value.splice(i, 1); return }
    if (asiChipLocked(s)) return
    asiStats.value.push(s)
  }
  const asiComplete = computed(() => {
    if (!asiNow.value) return true
    if (asiMode.value === 'feat') return !!featPick.value
    return asiStats.value.length === asiLimit.value
  })
  const {
    featPick,
    featPickerOpen,
    featConfigItem,
    featExcludedChoices,
    featEligibility,
    onFeatPick,
    onFeatChoicesConfirm,
  } = useLevelUpFeatSelection({
    values: () => props.values,
    entries,
    itemsById,
    newTotal,
    suggestStore,
  })

  // ─── бонус мастерства / ячейки ──────────────────────────────────────────────
  const profBefore = computed(() => proficiencyBonus(total.value))
  const profAfter = computed(() => proficiencyBonus(newTotal.value))
  const profChanges = computed(() => profBefore.value !== profAfter.value)

  const { entriesAfter, slotsAfter, levelUpSpellContext, slotDiff, slotChanges } = useLevelUpMagic({
    props, entries, target, classItem, subclassPick, isNew, isPlain, itemsById,
    newClassLevel, effectiveSubclassItem, effectiveSubclass,
  })

  const abilitySelections = useLevelUpAbilitySelections({
    values: () => props.values, classItem, entriesAfter, newTotal, pool: abilityPool,
    features, featureChoices: featureChoiceSel, spellSelection: classSpellSelection,
  })

  // ─── выбор цели ─────────────────────────────────────────────────────────────
  const scores = computed(() => Object.fromEntries(STATS.map((s) => [s, statScore(s)])))
  function prereq(c) { return multiclassCheck(c, scores.value) }
  const prereqLabel = multiclassPrerequisiteLabel
  const newPrereq = computed(() => (classItem.value ? prereq(classItem.value) : { ok: true }))
  const isMulticlass = computed(() => isNew.value && entries.value.length > 0)
  const multiclassKey = computed(() => multiclassProficiencyKey(classItem.value))
  const missingNewProfs = computed(() => {
    if (!isMulticlass.value) return ''
    const grants = MULTICLASS_PROFICIENCY_GRANTS[multiclassKey.value] || {}
    const missing = []
    for (const [bucket, labels] of Object.entries(grants)) {
      const known = new Set((props.values?.proficiencies?.[bucket] || []).map((label) => String(label).trim().toLocaleLowerCase('ru-RU')))
      missing.push(...labels.filter((label) => !known.has(label.trim().toLocaleLowerCase('ru-RU'))))
    }
    return missing.join(', ')
  })
  const newProfChoice = computed(() => isMulticlass.value ? MULTICLASS_PROFICIENCY_CHOICES[multiclassKey.value] || '' : '')

  async function loadSubclasses(cls, currentLevel) {
    subclassOptions.value = []
    subclassPick.value = null
    const d = cls?.data || {}
    const at = Number(d.subclass_level) || 99
    if (at > currentLevel) return
    const res = await fetchGet(`/items?typeId=${SUBCLASS_ITEM_TYPE}&limit=500${originFilterQuery('class', cls.id)}${sourceSuffix()}`)
    subclassOptions.value = res?.items || []
  }

  async function chooseClass(i) {
    target.value = { kind: 'class', index: i }
    resetPreview()
    step.value = 'preview'
    const e = entries.value[i]
    if (!e.subclass) await loadSubclasses(itemsById.value[e.id], e.level + 1)
  }
  async function chooseNew(item) {
    target.value = { kind: 'new', item }
    resetPreview()
    step.value = 'preview'
    await loadSubclasses(item, 1)
  }
  function choosePlain() {
    target.value = { kind: 'plain' }
    resetPreview()
    step.value = 'preview'
  }
  function backToPick() {
    step.value = 'pick'
    target.value = null
  }
  function resetPreview() {
    subclassOptions.value = []
    subclassPick.value = null
    hpMode.value = 'avg'
    hpRoll.value = null
    hpManual.value = null
    asiMode.value = '+2'
    asiStats.value = []
    asiSkipped.value = false
    featPick.value = null
    featConfigItem.value = null
    viewFeature.value = null
    classSpellSelection.value = null
    abilitySelections.reset()
  }

  const canAccept = computed(() => {
    if (saving.value) return false
    if (isPlain.value) return true
    if (!classItem.value || !hpReady.value) return false
    if (needSubclass.value && !subclassPick.value) return false
    if (asiNow.value && !asiSkipped.value && !asiComplete.value) return false
    if (!featureChoicesComplete.value || !abilitySelections.ready.value) return false
    if (levelUpSpellContext.value && (!classSpellSelection.value?.ready || classSpellSelection.value?.tab?.key !== levelUpSpellContext.value.tab.key)) return false
    return true
  })

  // ─── применение ─────────────────────────────────────────────────────────────
  async function accept() {
    if (!canAccept.value) return
    saving.value = true
    saveError.value = ''
    try {
      const updates = buildLevelUpUpdates({
        values: props.values || {},
        newTotal: newTotal.value,
        isPlain: isPlain.value,
        entriesAfter: entriesAfter.value,
        features: features.value,
        itemsById: { ...itemsById.value, ...Object.fromEntries(abilitySelections.catalogue.value.map(item => [item.id, item])) },
        abilitySelections: abilitySelections.selections.value,
        hitDieLabelOf,
        hitDieLabel: hitDieLabel.value,
        hpGain: hpGain.value,
        asiNow: asiNow.value,
        asiSkipped: asiSkipped.value,
        asiMode: asiMode.value,
        featPick: featPick.value,
        suggestItems: (typeId) => suggestStore.items(typeId),
        asiStats: asiStats.value,
        asiDelta: asiDelta.value,
        featureChoiceSelections: featureChoiceSel.value,
        applySlots: true,
        slotDiff: slotDiff.value,
        slotsAfter: slotsAfter.value,
        grantedNewIds: grantedNewIds.value,
        classItem: classItem.value,
        isMulticlass: isMulticlass.value,
        subclassItem: effectiveSubclassItem.value,
        subclassSelectedNow: !!subclassPick.value,
        classSpellSelection: classSpellSelection.value,
      })
      const catalogItems = [...abilityPool.value, ...Object.values(itemsById.value)]
      if (featPick.value) catalogItems.push(featPick.value)
      const additions = await levelUpSessionAdditions({
        values: props.values, updates, catalogItems,
        spellNames: spellNames.value,
        loadItems: itemsApi.byIds,
      })
      emit('apply', updates, additions)
    } catch {
      saveError.value = 'Не удалось применить повышение. Попробуйте ещё раз.'
    } finally { saving.value = false }
  }
  // ─── загрузка ───────────────────────────────────────────────────────────────
  onMounted(async () => {
    try {
      const ids = new Set()
      entries.value.forEach((e) => { ids.add(e.id); if (e.subclass) ids.add(e.subclass.id) })
      for (const key of ABILITY_VALUE_IDS) {
        for (const entry of (Array.isArray(props.values?.[key]) ? props.values[key] : [])) {
          if (entry?.id != null) ids.add(entry.id)
        }
      }
      const [byIds, abils, classes] = await Promise.all([
        ids.size ? itemsApi.byIds([...ids]) : Promise.resolve({ items: [] }),
        fetchGet(`/items?typeId=${CLASS_ABIL_TYPE}&limit=500${sourceSuffix()}`),
        fetchGet(`/items?typeId=${CLASS_ITEM_TYPE}&limit=300${sourceSuffix()}`),
      ])
      const map = {}
      ;(byIds?.items || []).forEach((it) => { map[it.id] = it })
      ;(classes?.items || []).forEach((it) => { if (!map[it.id]) map[it.id] = it })
      itemsById.value = map
      abilityPool.value = [...new Map([
        ...(abils?.items || []), ...(byIds?.items || []).filter(item => Number(item.typeId) === CLASS_ABIL_TYPE),
      ].map(item => [String(item.id), item])).values()]
      baseClasses.value = classes?.items || []
    } finally {
      loading.value = false
    }
  })

  return {
    loading, saving, saveError, step, entries, total, newTotal,
    chooseClass, chooseNew, choosePlain, backToPick, newClassOptions, prereq, prereqLabel,
    isPlain, isNew, classItem, targetEntry, newClassLevel, newPrereq, isMulticlass,
    missingNewProfs, newProfChoice, needSubclass, subclassOptions, subclassPick, features, featChoices,
    choiceCompleteFor, choiceSel, choiceCount, featureChoiceItemNames, toggleFeatureChoice, featureItemChoice, choiceOptions,
    choiceLocked, grantedSpellList, levelUpSpellContext, classSpellSelection, hp: reactive(hp), hitDieLabel, hitDieFace,
    asiNow, asiComplete, asiSkipped, asiModes, asiMode, setAsiMode, STATS,
    STAT_SHORT, asiStats, asiChipLocked, toggleAsiStat, statScore, asiDelta, featPick,
    featPickerOpen, profChanges, profBefore, profAfter, slotChanges, viewFeature, featEligibility,
    onFeatPick, featureChoiceItemEligibility, featureChoiceItemFilters, onFeatureChoiceItemPick, featConfigItem, featExcludedChoices, onFeatChoicesConfirm,
    canAccept, accept, abilitySelections,
  }
}
