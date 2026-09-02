import { computed, watch } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import {
  addStatusInstance,
  collectCharacterStatuses,
  linkedStatusActive,
  normalizeStatusInstances,
  removeStatusInstancesByEffect,
  removeStatusInstancesByParam,
  removeStatusInstance,
  removeStatusesBySource,
  setStatusInstanceLevel,
  statusEffectLinks,
  statusInstanceActiveByParam,
  statusItemIds,
  toggleLinkedStatus,
} from '@/features/character-editor/lib/characterStatuses'

export function useCharacterStatuses(values, characterResources) {
  const itemsById = characterResources.itemsById
  let catalogPromise = null

  async function ensureItems(ids = statusItemIds(values.value)) {
    return characterResources.ensureItems(ids)
  }

  async function ensureCatalog() {
    if (catalogPromise) return catalogPromise
    catalogPromise = itemsApi.listAll(15)
      .then(response => {
        characterResources.rememberItems(response?.items || [])
        return response?.items || []
      })
      .catch(() => [])
    return catalogPromise
  }

  watch(
    () => statusItemIds(values.value).join(','),
    () => { ensureItems() },
    { immediate: true },
  )
  ensureCatalog()

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
    ensureCatalog,
    ensureLinks,
    links,
    normalized() { return normalizeStatusInstances(values.value?.states) },
    addManual(effect) { return addStatusInstance(values.value, effect, { source: { kind: 'manual' } }) },
    add(effect, options) { return addStatusInstance(values.value, effect, options) },
    remove(uid) { return removeStatusInstance(values.value, uid) },
    setLevel(uid, level) { return setStatusInstanceLevel(values.value, uid, level) },
    itemByCode(code) {
      return [...itemsById.value.values()].find(item => item?.data?.code === code) || null
    },
    removeEffect(effect) { return removeStatusInstancesByEffect(values.value, effect) },
    removeByParam(key, value) { return removeStatusInstancesByParam(values.value, key, value) },
    activeByParam(effect, key, value) { return statusInstanceActiveByParam(values.value, effect, key, value) },
    removeBySource(source) { return removeStatusesBySource(values.value, source) },
    linkedActive(item, link, source) { return linkedStatusActive(values.value, item, link, source) },
    toggleLinked(effect, item, link, source) { return toggleLinkedStatus(values.value, effect, item, link, source) },
  }
}
