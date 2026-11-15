import { collectStatusDerivedEffects } from '@/features/character-editor/lib/characterStatuses'
import { derivedRollEffects, matchingDerivedEffects } from '@/features/character-editor/lib/characterDerivedEffects'
import { resolveRollMode } from '@/features/character-editor/blocks/dnd/lib/rollMode'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { ref } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { npcArmorClass } from '../lib/npcArmorClass'
import { abilityScoreWithEffects } from '@/features/character-editor/lib/abilityScoreEffects'
import { abilityModifier } from '@/shared/lib/dnd'

export function useEncounterNpcData() {
  const npcItemCache = ref({})

  function cacheItem(item) {
    if (item && item.id != null) {
      npcItemCache.value = { ...npcItemCache.value, [item.id]: item }
    }
  }

  async function ensureNpcItems(combatants) {
    const ids = [...new Set((combatants || []).filter(c => c.type === 'npc').flatMap(c => [c.itemId, ...(c.effectInstances || []).map(row => row.effect_id)]).filter(id => id != null && !npcItemCache.value[id]))]
    if (!ids.length) return
    const res = await itemsApi.byIds(ids).catch(() => null)
    const items = res?.items || []
    if (!items.length) return
    const next = { ...npcItemCache.value }
    items.forEach(it => { if (it && it.id != null) next[it.id] = it })
    npcItemCache.value = next
  }

  function effects(c) { return collectStatusDerivedEffects({ states: c?.effectInstances || [] }, new Map(Object.entries(npcItemCache.value))) }
  function npcRollEffects(c, context) {
    const rules = effects(c)
    return { mode: resolveRollMode('auto', derivedRollEffects(rules, context)).mode, formula: matchingDerivedEffects(rules, 'roll_bonus', context).map(row => row.formula).join('+') }
  }
  function npcItem(c) {
    if (!c || c.type !== 'npc' || c.itemId == null) return null
    return npcItemCache.value[c.itemId] || null
  }

  function npcBaseData(c) {
    const it = npcItem(c)?.data || {}
    const flat = {
      ...(it.identity || {}),
      ...(it.combat || {}),
      ...(it.stats || {}),
    }
    return { ...flat, ...(c?.override || {}) }
  }
  function npcData(c) {
    const result = npcBaseData(c), rules = effects(c)
    for (const [id, stat] of Object.entries(SUGGEST16_TO_STAT)) {
      const key = stat.toLowerCase(), base = Number(result[key] ?? 10)
      const score = abilityScoreWithEffects(base, id, rules)
      if (score !== base) result[key] = score
    }
    return result
  }

  function npcName(c) {
    const ov = c?.override?.name
    if (ov != null && String(ov).trim() !== '') return ov
    return npcItem(c)?.name || 'Существо'
  }

  function npcAc(c) {
    const v = npcData(c).ac
    return npcArmorClass(v, effects(c))
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
    if (!Number.isFinite(bonus)) return null
    const base = Number(npcBaseData(c)[key] ?? 10)
    const score = Number(npcData(c)[key] ?? 10)
    return bonus + abilityModifier(score) - abilityModifier(base)
  }

  function npcHpFormula(c) {
    return (npcData(c).hp_formula || '').toString()
  }

  return {
    npcItemCache,
    npcRollEffects,
    cacheItem,
    ensureNpcItems,
    npcItem,
    npcData,
    npcName,
    npcAc,
    npcHpMax,
    npcDex,
    npcAbilityScore,
    npcSavingThrow,
    npcHpFormula,
  }
}
