import { computed, ref, watch } from 'vue'

export function useLevelUpFeatureChoices(features, suggestStore) {
  const selections = ref({})

  function featureChoice(feature) {
    const choice = feature?.data?.choice
    if (!choice) return null
    return choice.from_suggest_id || (Array.isArray(choice.options) && choice.options.length)
      ? choice
      : null
  }

  const choosableFeatures = computed(() => features.value.filter(featureChoice))
  watch(choosableFeatures, (list) => {
    list.forEach((feature) => {
      const choice = featureChoice(feature)
      if (choice?.from_suggest_id) suggestStore.ensure(Number(choice.from_suggest_id))
    })
  }, { immediate: true })

  function choiceCount(feature) {
    return Number(featureChoice(feature)?.count) || 1
  }

  function choiceOptions(feature) {
    const choice = featureChoice(feature)
    if (!choice) return []
    if (choice.from_suggest_id) {
      return suggestStore.items(Number(choice.from_suggest_id))
        .map((item) => ({ value: item.id, label: item.value }))
    }
    return (choice.options || []).map((option) => ({
      value: option.label,
      label: option.label,
      desc: option.desc,
    }))
  }

  function selected(abilityId) {
    return selections.value[abilityId] || []
  }

  function choiceLocked(feature, option) {
    const current = selected(feature.id)
    if (current.some((value) => String(value) === String(option.value))) return false
    return current.length >= choiceCount(feature)
  }

  function toggleChoice(feature, value) {
    const current = selected(feature.id)
    const hasValue = current.some((entry) => String(entry) === String(value))
    let next
    if (choiceCount(feature) === 1) next = hasValue ? [] : [value]
    else if (hasValue) next = current.filter((entry) => String(entry) !== String(value))
    else next = current.length < choiceCount(feature) ? [...current, value] : current
    selections.value = { ...selections.value, [feature.id]: next }
  }

  function choiceComplete(feature) {
    return selected(feature.id).length === choiceCount(feature)
  }

  const complete = computed(() => choosableFeatures.value.every(choiceComplete))

  return {
    featureChoice,
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
