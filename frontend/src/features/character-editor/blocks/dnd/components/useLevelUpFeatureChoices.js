import { computed, ref, watch } from 'vue'
import { itemChoiceRows } from '@/features/items/lib/itemChoices'

export function useLevelUpFeatureChoices(features, suggestStore, optionEligibility = null) {
  const selections = ref({})

  function featureChoiceRows(feature) {
    return itemChoiceRows(feature)
  }

  function featureChoices(feature) { return featureChoiceRows(feature).map((row) => row.choice) }
  function featureChoice(feature) { return featureChoices(feature)[0] || null }
  function selectionKey(feature, choice) {
    return featureChoiceRows(feature).find((row) => row.choice.key === choice?.key)?.id ?? feature?.id
  }

  const choosableFeatures = computed(() => features.value.filter((feature) => featureChoiceRows(feature).length))
  watch(choosableFeatures, (list) => {
    list.forEach((feature) => {
      featureChoices(feature).forEach((choice) => {
        if (choice.from_suggest_id != null) suggestStore.ensure(Number(choice.from_suggest_id))
        for (const source of (choice.suggest_sources || [])) suggestStore.ensure(Number(source.suggest_id))
      })
    })
  }, { immediate: true })

  function choiceCount(feature, choice = featureChoice(feature)) {
    return Number(choice?.count) || 1
  }

  function choiceOptions(feature, choice = featureChoice(feature)) {
    if (!choice) return []
    if (choice.from_suggest_id != null) {
      return suggestStore.items(Number(choice.from_suggest_id))
        .map((item) => ({ value: item.id, label: item.value }))
        .filter((option) => !optionEligibility || optionEligibility(feature, choice, option.value)?.eligible !== false)
    }
    if (choice.source === 'suggest_union') {
      return (choice.suggest_sources || []).flatMap((source) => (
        suggestStore.items(Number(source.suggest_id)) || []
      ).map((item) => ({
        value: `${source.prefix}:${item.id}`,
        label: item.value,
        desc: source.label || item.desc || '',
      }))).filter((option) => !optionEligibility || optionEligibility(feature, choice, option.value)?.eligible !== false)
    }
    return (choice.options || []).map((option) => ({
      value: option.value ?? option.label,
      label: option.label || option.value,
      desc: option.desc || '',
    })).filter((option) => option.value != null && option.value !== '')
      .filter((option) => !optionEligibility || optionEligibility(feature, choice, option.value)?.eligible !== false)
  }

  function selected(feature, choice = featureChoice(feature)) {
    return selections.value[selectionKey(feature, choice)] || []
  }

  function choiceLocked(feature, choice, option) {
    const current = selected(feature, choice)
    if (current.some((value) => String(value) === String(option.value))) return false
    return current.length >= choiceCount(feature, choice)
  }

  function toggleChoice(feature, choice, value) {
    const current = selected(feature, choice)
    const hasValue = current.some((entry) => String(entry) === String(value))
    let next
    if (choiceCount(feature, choice) === 1) next = hasValue ? [] : [value]
    else if (hasValue) next = current.filter((entry) => String(entry) !== String(value))
    else next = current.length < choiceCount(feature, choice) ? [...current, value] : current
    selections.value = { ...selections.value, [selectionKey(feature, choice)]: next }
  }

  function choiceComplete(feature, choice) {
    if (choice) return selected(feature, choice).length === choiceCount(feature, choice)
    return featureChoices(feature).every((entry) => choiceComplete(feature, entry))
  }

  const complete = computed(() => choosableFeatures.value.every((feature) => choiceComplete(feature)))

  return {
    featureChoice,
    featureChoices,
    selections,
    choiceCount,
    choiceOptions,
    selected,
    choiceLocked,
    toggleChoice,
    choiceComplete,
    complete,
  }
}
