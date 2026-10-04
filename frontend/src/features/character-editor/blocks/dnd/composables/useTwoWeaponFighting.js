import { unref } from 'vue'
import { twoWeaponFightingOption } from '../lib/twoWeaponFighting'
import { prepareWeaponRollEntry } from '../lib/weaponThrow'

export function useTwoWeaponFighting(charCtx, { item, propertyItems, actions }) {
  return (entry, options) => {
    const available = actions(entry)
    if (options?.actionKeys?.some(key => available.find(action => action.key === key)?.prepaid)) return null
    const prepared = options
      ? prepareWeaponRollEntry(entry, item(entry), propertyItems(entry), available, options.actionKeys || [])
      : entry
    return twoWeaponFightingOption(prepared, item(entry), propertyItems(entry),
      unref(charCtx.characterDerivedEffects?.effects) || [], unref(charCtx.rulesVersion) || '2014')
  }
}
