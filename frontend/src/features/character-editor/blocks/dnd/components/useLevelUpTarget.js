import { computed, ref } from 'vue'

export function useLevelUpTarget({ entries, itemsById, baseClasses, subclassOptions, subclassPick }) {
  const target = ref(null)
  const isPlain = computed(() => target.value?.kind === 'plain')
  const isNew = computed(() => target.value?.kind === 'new')
  const targetEntry = computed(() => (
    target.value?.kind === 'class' ? entries.value[target.value.index] : null
  ))
  const classItem = computed(() => {
    if (target.value?.kind === 'new') return target.value.item
    return targetEntry.value ? itemsById.value[targetEntry.value.id] || null : null
  })
  const newClassLevel = computed(() => (
    isNew.value ? 1 : (targetEntry.value?.level || 0) + 1
  ))
  const effectiveSubclass = computed(() => (
    subclassPick.value || targetEntry.value?.subclass || null
  ))
  const needSubclass = computed(() => {
    const subclassLevel = Number(classItem.value?.data?.subclass_level) || 99
    return !isPlain.value
      && subclassLevel <= newClassLevel.value
      && !targetEntry.value?.subclass
      && subclassOptions.value.length > 0
  })
  const newClassOptions = computed(() => {
    const taken = new Set(entries.value.map((entry) => Number(entry.id)))
    return baseClasses.value.filter((item) => !taken.has(Number(item.id)))
  })

  return {
    target,
    isPlain,
    isNew,
    targetEntry,
    classItem,
    newClassLevel,
    effectiveSubclass,
    needSubclass,
    newClassOptions,
  }
}
