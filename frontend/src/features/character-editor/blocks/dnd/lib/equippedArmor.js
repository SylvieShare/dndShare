import { resolveMagicArmor } from '@/features/character-editor/lib/magicArmor'
import { abilityModifier, resolveNumValue, sumBonuses } from '@/shared/lib/dnd'
import { inventoryEntries } from '@/features/character-editor/lib/characterMagicItems'
import { hasItemProficiency } from '@/features/character-editor/lib/itemProficiency'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { applyArmorMinimum } from '@/shared/lib/armorMinimum'

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function itemFrom(items, id) {
  if (items instanceof Map) return items.get(String(id)) || items.get(id) || null
  return items?.[String(id)] || items?.[id] || null
}

function manualArmorBonuses(values) {
  return (Array.isArray(values?.armor?.bonuses) ? values.armor.bonuses : []).filter((bonus) => {
    const label = String(bonus?.name || bonus?.title || '').trim().toLocaleLowerCase('ru')
    return !(bonus?.readonly && label.startsWith('экипировано:'))
  })
}

function isArmorItem(item) {
  return [12, 19].includes(Number(item?.typeId)) && item?.data?.armor && typeof item.data.armor === 'object'
}

function armorProficient(item, values, suggestItems, grantedProficiencies) {
  if (item?.data?.required_armor_proficiency == null) return true
  return hasItemProficiency(item, values, suggestItems, grantedProficiencies)
}

function instanceBonus(entry) {
  return number(entry?.params?.magic_bonus)
}

/**
 * Derives armor from equipped inventory and weapon instances.
 * One best body armor and one best shield are active; duplicates never stack.
 */
export function deriveEquippedArmor(values = {}, items = {}, suggestItems = () => [], derivedRules = {}, grantedProficiencies = [], rulesVersion = '2014') {
  const dexterity = abilityModifier(resolveNumValue(values?.DEX?.value ?? 10))
  const strength = resolveNumValue(values?.STR?.value ?? 10)
  const equipped = inventoryEntries(values).filter(row => row.equipped).map(row => row.entry)
  const candidates = equipped.flatMap((entry, index) => {
    const item = resolveMagicArmor(itemFrom(items, entry.magic_item_id ?? entry.item_id), entry, items, values)
    if (!isArmorItem(item)) return []
    const rule = item.data.armor
    const shield = rule.shield === true || item.data.category === 'shield'
    const dex = shield || rule.use_dex === false
      ? 0
      : (rule.dex_cap == null ? dexterity : Math.min(dexterity, number(rule.dex_cap)))
    const magicBonus = instanceBonus(entry)
    const proficient = armorProficient(item, values, suggestItems, grantedProficiencies)
    const value = shield && rulesVersion === '2024' && !proficient ? 0 : shield
      ? number(rule.shield_bonus, 2) + magicBonus
      : number(rule.ac, 10) + dex + magicBonus
    return [{
      uid: String(entry.uid || `${entry.item_id}-${index}`),
      entry,
      item,
      name: entry.override?.name || item.name || 'Доспех',
      shield,
      dex,
      magicBonus,
      value,
      proficient,
      stealthDisadvantage: !shield && item.data.stealth_disadvantage === true,
    }]
  })

  const best = (rows) => rows.reduce((selected, row) => (
    !selected || row.value > selected.value ? row : selected
  ), null)
  const bodies = candidates.filter(row => !row.shield)
  const shields = candidates.filter(row => row.shield)
  const body = best(bodies)
  const shield = best(shields)
  const formulas = (Array.isArray(derivedRules?.formulas) ? derivedRules.formulas : []).flatMap((rule) => {
    if (body || (shield && rule.allow_shield === false)) return []
    const modifiers = (Array.isArray(rule.ability_ids) ? rule.ability_ids : []).map((suggestId) => {
      const stat = SUGGEST16_TO_STAT[Number(suggestId)]
      return stat ? abilityModifier(resolveNumValue(values?.[stat]?.value ?? 10)) : 0
    })
    return [{
      ...rule,
      value: number(rule.base, 10) + modifiers.reduce((sum, modifier) => sum + modifier, 0),
      modifiers,
    }]
  })
  const abilityFormula = best(formulas)
  const bodyValue = body?.value ?? abilityFormula?.value ?? 10 + dexterity
  const matchesEquipment = (rule) => {
    if (rule.allow_shield === false && shield) return false
    if (rule.requires_armor && !body) return false
    if (rule.requires_no_armor && body) return false
    if (rule.forbid_heavy_armor && body?.item?.data?.category === 'heavy') return false
    return true
  }
  const abilityBonuses = (Array.isArray(derivedRules?.bonuses) ? derivedRules.bonuses : []).filter(matchesEquipment).map(rule => ({
    ...rule,
    name: rule.label || rule.source_label || 'Способность',
    title: rule.label || rule.source_label || 'Способность',
    value: number(rule.value),
    readonly: true,
  })).filter(rule => rule.value)
  const manualBonuses = manualArmorBonuses(values)
  const manualBonus = sumBonuses(manualBonuses) + sumBonuses(abilityBonuses)
  const shieldValue = shield?.value ?? 0
  const armorMinimum = applyArmorMinimum(bodyValue + shieldValue + manualBonus, (derivedRules.minimums || []).filter(matchesEquipment))
  const active = [body, shield].filter(Boolean)
  const nonproficient = active.filter(row => !row.proficient)
  const armorPenalty = nonproficient.some(row => rulesVersion !== '2024' || !row.shield)
  const strengthRequired = number(body?.item?.data?.strength_required)
  const ancestry = `${values?.race?.name || ''} ${values?.subrace?.name || ''}`.toLocaleLowerCase('ru')
  const ignoresArmorStrength = rulesVersion !== '2024' && (ancestry.includes('дварф') || ancestry.includes('dwarf'))
  const speedPenalty = body && strengthRequired > strength && !ignoresArmorStrength ? 10 : 0
  const activeUids = new Set(active.map(row => row.uid))
  const byUid = Object.fromEntries(candidates.map(row => [row.uid, {
    active: activeUids.has(row.uid),
    shield: row.shield,
    value: row.value,
    proficient: row.proficient,
    stealthDisadvantage: row.stealthDisadvantage,
  }]))

  return {
    ...armorMinimum,
    dexterity,
    strength,
    body,
    abilityFormula,
    abilityBonuses,
    shield,
    bodies,
    shields,
    byUid,
    manualBonuses,
    manualBonus,
    bodyConflict: bodies.length > 1,
    shieldConflict: shields.length > 1,
    stealthDisadvantage: !!body?.stealthDisadvantage,
    nonproficient,
    strengthDexDisadvantage: armorPenalty,
    castingBlocked: armorPenalty,
    strengthRequired,
    speedPenalty,
  }
}
