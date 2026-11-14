import { proficiencyBonus, sumBonuses } from '@/shared/lib/dnd'
import { collectCharacterDerivedEffects, derivedArmorRules, derivedGrantedProficiencies } from '@/features/character-editor/lib/characterDerivedEffects'
import { deriveEquippedArmor } from '@/features/character-editor/blocks/dnd/lib/equippedArmor'
import { passiveScores } from '@/features/character-editor/lib/passiveScores'
import { statusValueProjection } from '@/features/character-editor/lib/statusValueProjection'

export function participantDefenses(values, items = new Map(), suggestItems = () => [], rulesVersion = '2014') {
  values = statusValueProjection(values, items)
  const effects = collectCharacterDerivedEffects(values, items)
  const mastery = values.prof_bonus || {}
  const proficiency = (mastery.auto === false ? Number(mastery.v) || 0 : proficiencyBonus(values.lvl?.level || 1)) + sumBonuses(mastery.bonuses)
  const armor = deriveEquippedArmor(values, items, suggestItems, derivedArmorRules(effects), derivedGrantedProficiencies(effects, 'armor_proficiency'), rulesVersion)
  const passives = passiveScores(values, effects, proficiency)
  return { armorClass: armor.total, passives }
}
