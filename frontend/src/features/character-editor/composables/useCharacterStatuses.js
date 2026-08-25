import { computed, watch } from 'vue'
import {
  addStatusInstance,
  collectCharacterStatuses,
  linkedStatusActive,
  normalizeStatusInstances,
  removeStatusInstancesByEffect,
  removeStatusInstance,
  removeStatusesBySource,
  statusEffectLinks,
  statusItemIds,
  toggleLinkedStatus,
} from '@/features/character-editor/lib/characterStatuses'

export function useCharacterStatuses(values, characterResources) {
  const itemsById = characterResources.itemsById

  async function ensureItems(ids = statusItemIds(values.value)) {
    return characterResources.ensureItems(ids)
  }

  watch(
    () => statusItemIds(values.value).join(','),
    () => { ensureItems() },
    { immediate: true },
  )

  const entries = computed(() => collectCharacterStatuses(values.value, itemsById.value))

  async function ensureLinks(item) {
    const ids = statusEffectLinks(item).map(link => link.effect_id)
    if (ids.length) await characterResources.ensureItems(ids)
    return links(item)
  }

  function links(item) {
    return statusEffectLinks(item).map(link => ({
      ...link,
      effect: itemsById.value.get(String(link.effect_id)) || null,
    }))
  }

  return {
    entries,
    ensureItems,
    ensureLinks,
    links,
    normalized() { return normalizeStatusInstances(values.value?.states) },
    addManual(effect) { return addStatusInstance(values.value, effect, { source: { kind: 'manual' } }) },
    remove(uid) { return removeStatusInstance(values.value, uid) },
    removeEffect(effect) { return removeStatusInstancesByEffect(values.value, effect) },
    removeBySource(source) { return removeStatusesBySource(values.value, source) },
    linkedActive(item, link, source) { return linkedStatusActive(values.value, item, link, source) },
    toggleLinked(effect, item, link, source) { return toggleLinkedStatus(values.value, effect, item, link, source) },
  }
}
