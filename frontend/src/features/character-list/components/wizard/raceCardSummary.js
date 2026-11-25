import { plainOriginDescription } from '@/features/items/lib/originPresentation'
import { pushFact, suggestNames } from './cardSummaryFacts'
import { extractGrants } from '@/features/character-editor/settings/dnd/creation/grants'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { STAT_SHORT } from '@/features/character-list/components/wizard/labels'
import { actionableItemChoices } from '@/features/items/lib/itemChoices'

export function raceCardSummary({ race, raceAbilities = [], suggestValue = () => '', subraces = [], selected = false, raceVariant = null, subrace = null }) {
  const grants = extractGrants({ race, subrace, raceVariant })
  const facts = []
  const asi = grants.asi.map((entry) => `${STAT_SHORT[entry.stat]} +${entry.bonus}`)
  if (grants.asiChoice) asi.push(`+${grants.asiChoice.bonus} к ${grants.asiChoice.count} на выбор`)
  if (!asi.length && grants.raceVariants?.length) asi.push('Зависит от варианта')
  pushFact(facts, 'Характеристики', asi.join(', '))
  pushFact(facts, 'Тип существа', race?.data?.creature_type || '')
  pushFact(facts, 'Скорость', grants.speed != null ? `${grants.speed} фт` : '')
  const sizes = [...new Set((race?.data?.variants || []).map(v => v.size).filter(Boolean))]
  pushFact(facts, 'Размер', !raceVariant && sizes.length > 1 ? sizes.join(' / ') : grants.size || '')
  pushFact(facts, 'Языки', suggestNames(grants.languages, 6, suggestValue).join(', '), true)

  const proficiencies = [
    ...suggestNames(grants.skillProficiencies, 15, suggestValue),
    ...suggestNames(grants.proficiencies.armor, 3, suggestValue),
    ...suggestNames(grants.proficiencies.weapon, 4, suggestValue),
    ...suggestNames(grants.proficiencies.tool, 5, suggestValue),
  ]
  pushFact(facts, 'Владения', proficiencies.join(', '), true)

  const raceFeatures = featuresForBinding(raceAbilities, { raceId: race?.id }, 1)
  const abilities = raceFeatures
    .filter((ability) => ability.name && !ability.data?.choice_only)
    .map((ability) => ({ name: ability.name, description: ability.data?.desc || ability.data?.description || '' }))
  if (!selected) pushFact(facts, 'Способности', abilities.map((ability) => ability.name).join(', '), true, abilities)

  const choices = []
  if (grants.raceVariants?.length) choices.push('вариант расы')
  if (grants.asiChoice) choices.push('характеристики')
  if (grants.raceSkillChoice) choices.push('навыки')
  if (grants.langChoice) choices.push('язык')
  if (grants.featChoice) choices.push('черта')

  const featureChoices = raceFeatures.some((ability) => actionableItemChoices(ability).length)
  if (featureChoices && !choices.includes('особенности')) choices.push('особенности')

  return {
    description: plainOriginDescription(race, 220),
    facts,
    choices,
    subraces: [...new Set(subraces.filter(Boolean))],
  }
}
