import { extractGrants } from '@/features/character-editor/settings/dnd/creation/grants'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { STAT_SHORT } from '@/features/character-list/components/wizard/labels'
import { actionableItemChoices } from '@/features/items/lib/itemChoices'

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim()
}

function resolved(ids, typeId, suggestValue) {
  return [...new Set((ids || []).map((id) => suggestValue(typeId, id)).filter(Boolean))]
}

function pushFact(facts, label, value, wide = false, entries = []) {
  if (value) facts.push({ label, value, wide, entries })
}

export function shortRaceDescription(race, limit = 220) {
  const source = race?.data?.short_description || race?.data?.summary || race?.data?.description || ''
  const text = cleanText(source)
  if (text.length <= limit) return text
  return `${text.slice(0, limit).replace(/\s+\S*$/, '')}…`
}

export function raceCardSummary({ race, raceAbilities = [], suggestValue = () => '', subraces = [] }) {
  const grants = extractGrants({ race })
  const facts = []
  const asi = grants.asi.map((entry) => `${STAT_SHORT[entry.stat]} +${entry.bonus}`)
  if (grants.asiChoice) asi.push(`+${grants.asiChoice.bonus} к ${grants.asiChoice.count} на выбор`)
  if (!asi.length && grants.raceVariants?.length) asi.push('Зависит от варианта')
  pushFact(facts, 'Характеристики', asi.join(', '))
  pushFact(facts, 'Скорость', grants.speed != null ? `${grants.speed} фт` : '')
  pushFact(facts, 'Размер', grants.size || '')
  pushFact(facts, 'Языки', resolved(grants.languages, 6, suggestValue).join(', '), true)

  const proficiencies = [
    ...resolved(grants.skillProficiencies, 15, suggestValue),
    ...resolved(grants.proficiencies.armor, 3, suggestValue),
    ...resolved(grants.proficiencies.weapon, 4, suggestValue),
    ...resolved(grants.proficiencies.tool, 5, suggestValue),
  ]
  pushFact(facts, 'Владения', proficiencies.join(', '), true)

  const raceFeatures = featuresForBinding(raceAbilities, { raceId: race?.id }, 1)
  const abilities = raceFeatures
    .filter((ability) => ability.name)
    .map((ability) => ({ name: ability.name, description: ability.data?.desc || ability.data?.description || '' }))
  pushFact(facts, 'Способности', abilities.map((ability) => ability.name).join(', '), true, abilities)

  const choices = []
  if (grants.raceVariants?.length) choices.push('вариант расы')
  if (grants.asiChoice) choices.push('характеристики')
  if (grants.raceSkillChoice) choices.push('навыки')
  if (grants.langChoice) choices.push('язык')
  if (grants.featChoice) choices.push('черта')

  const featureChoices = raceFeatures.some((ability) => actionableItemChoices(ability).length)
  if (featureChoices && !choices.includes('особенности')) choices.push('особенности')

  return {
    description: shortRaceDescription(race),
    facts,
    choices,
    subraces: [...new Set(subraces.filter(Boolean))],
  }
}
