import { ref } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { normalizedEncounterLetter } from '@/features/sessions/lib/encounterHelpers'

export function useEncounterNpcData() {
  const npcItemCache = ref({})

  function cacheItem(item) {
    if (item && item.id != null) {
      npcItemCache.value = { ...npcItemCache.value, [item.id]: item }
    }
  }

  async function ensureNpcItems(combatants) {
    const ids = [...new Set(
      (combatants || [])
        .filter(c => c.type === 'npc' && c.itemId != null && !npcItemCache.value[c.itemId])
        .map(c => c.itemId)
    )]
    if (!ids.length) return
    const res = await itemsApi.byIds(ids).catch(() => null)
    const items = res?.items || []
    if (!items.length) return
    const next = { ...npcItemCache.value }
    items.forEach(it => { if (it && it.id != null) next[it.id] = it })
    npcItemCache.value = next
  }

  function npcItem(c) {
    if (!c || c.type !== 'npc' || c.itemId == null) return null
    return npcItemCache.value[c.itemId] || null
  }

  function npcData(c) {
    const it = npcItem(c)?.data || {}
    const flat = {
      ...(it.identity || {}),
      ...(it.combat || {}),
      ...(it.stats || {}),
    }
    return { ...flat, ...(c?.override || {}) }
  }

  function npcName(c) {
    const ov = c?.override?.name
    if (ov != null && String(ov).trim() !== '') return ov
    return npcItem(c)?.name || 'Существо'
  }

  function npcActorName(c) {
    const name = String(npcName(c)).trim()
    const letter = normalizedEncounterLetter(c?.markerLetter)
    return letter ? `${name} ${letter}` : name
  }

  function npcAc(c) {
    const v = npcData(c).ac
    return v == null || v === '' ? null : v
  }

  function npcHpMax(c) {
    return Number(npcData(c).hp) || 0
  }

  function npcDex(c) {
    const v = Number(npcData(c).dex)
    return Number.isFinite(v) ? v : null
  }

  function npcAbilityScore(c, ability) {
    const value = npcData(c)[String(ability || '').toLowerCase()]
    if (value == null || value === '') return null
    const score = Number(value)
    return Number.isFinite(score) ? score : null
  }

  function npcSavingThrow(c, ability) {
    const key = String(ability || '').toLowerCase()
    const override = c?.override?.saving_throws
    const value = override && typeof override === 'object' && !Array.isArray(override)
      ? override[key]
      : npcItem(c)?.data?.saving_throws?.[key]
    if (value == null || value === '') return null
    const bonus = Number(value)
    return Number.isFinite(bonus) ? bonus : null
  }

  function npcHpFormula(c) {
    return (npcData(c).hp_formula || '').toString()
  }

  return {
    npcItemCache,
    cacheItem,
    ensureNpcItems,
    npcItem,
    npcData,
    npcName,
    npcActorName,
    npcAc,
    npcHpMax,
    npcDex,
    npcAbilityScore,
    npcSavingThrow,
    npcHpFormula,
  }
}
