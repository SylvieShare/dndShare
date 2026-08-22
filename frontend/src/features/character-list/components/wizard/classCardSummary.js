import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { grantedSpellsAt } from '@/features/character-editor/blocks/dnd/lib/levelUp'
import { STAT_FULL, SUGGEST16_TO_STAT } from '@/features/character-list/components/wizard/labels'
import { dieLabel } from '@/shared/lib/systemDice'
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

function statNames(ids) {
  return [...new Set((ids || []).map((id) => STAT_FULL[SUGGEST16_TO_STAT[Number(id)]]).filter(Boolean))]
}

function pushFact(facts, label, value, wide = false, entries = []) {
  if (value) facts.push({ label, value, wide, entries })
}

function ownerIds(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => Number(row?.id ?? row))
    .filter(Number.isFinite)
}

export function shortClassDescription(charClass, limit = 220) {
  const source = charClass?.data?.short_description || charClass?.data?.summary || charClass?.data?.description || ''
  const text = cleanText(source)
  if (text.length <= limit) return text
  return `${text.slice(0, limit).replace(/\s+\S*$/, '')}…`
}

export function classCardSummary({ charClass, classAbilities = [], suggestValue = () => '', subclasses = [] }) {
  const data = charClass?.data || {}
  const facts = []
  pushFact(facts, 'Кость хитов', dieLabel(data.hit_die))
  pushFact(facts, 'Ключевые характеристики', statNames(data.primary_abilities).join(', '))
  pushFact(facts, 'Спасброски', statNames(data.saves).join(', '))

  const armor = resolved(data.armor_prof, 3, suggestValue)
  const weapons = resolved(data.weapon_prof, 4, suggestValue)
  const tools = resolved(data.tool_prof, 5, suggestValue)
  const proficiencies = [
    armor.length ? `доспехи: ${armor.join(', ')}` : '',
    weapons.length ? `оружие: ${weapons.join(', ')}` : '',
    tools.length ? `инструменты: ${tools.join(', ')}` : '',
  ].filter(Boolean)
  pushFact(facts, 'Владения', proficiencies.join(' · '), true)

  const classFeatures = featuresForBinding(classAbilities, { classId: charClass?.id }, 1)
  const abilities = classFeatures
    .filter((ability) => ability.name)
    .map((ability) => ({ name: ability.name, description: ability.data?.desc || ability.data?.description || '' }))
  pushFact(facts, 'Способности 1 уровня', abilities.map((ability) => ability.name).join(', '), true, abilities)

  const choices = []
  if (data.starting_equipment || data.startingEquipment) choices.push('снаряжение')
  if (data.skill_choice?.count) choices.push(`${data.skill_choice.count} навыка`)
  if (data.tool_prof_choice?.count) choices.push(`${data.tool_prof_choice.count} инструмента`)
  if (classFeatures.some((ability) => actionableItemChoices(ability).length)) choices.push('особенности')
  const spellcasting = data.spellcasting
  if (spellcasting && (Number(spellcasting.cantrips_known) > 0 || Number(spellcasting.spells_known) > 0)) choices.push('заклинания')
  if (Number(data.subclass_level) === 1 && subclasses.length) choices.push('архетип')

  return {
    description: shortClassDescription(charClass),
    facts,
    choices,
    subclasses: [...new Set(subclasses.filter(Boolean))],
    subclassLevel: Number(data.subclass_level) || null,
  }
}

export function subclassCardSummary({ subclass, charClass, classAbilities = [], spellPool = [], suggestValue = () => '' }) {
  const subclassId = Number(subclass?.id)
  const features = featuresForBinding(classAbilities, {
    classId: charClass?.id,
    subclassId,
  }, 1)
    .filter((ability) => ownerIds(ability?.data?.subclass_ids).includes(subclassId))
    .filter((ability) => ability?.name)
    .map((ability) => ({
      name: ability.name,
      description: cleanText(ability.data?.desc || ability.data?.description || ''),
    }))

  const spellNames = new Map((spellPool || []).map((spell) => [Number(spell.id), spell.name]))
  const granted = grantedSpellsAt([subclass], 1)
  const namedSpells = granted.map((row) => spellNames.get(Number(row.spellId))).filter(Boolean)
  const benefits = [...features]
  if (namedSpells.length) {
    benefits.push({ name: `Заклинания: ${[...new Set(namedSpells)].join(', ')}`, description: '' })
  } else if (granted.length) {
    benefits.push({ name: `Заклинания архетипа: ${granted.length}`, description: '' })
  }

  const data = subclass?.data || {}
  const proficiencies = [
    ...resolved(data.armor_prof, 3, suggestValue),
    ...resolved(data.weapon_prof, 4, suggestValue),
    ...resolved(data.tool_prof, 5, suggestValue),
  ]
  if (proficiencies.length) benefits.push({ name: `Владения: ${proficiencies.join(', ')}`, description: '' })

  return {
    description: shortClassDescription(subclass, 160),
    benefits,
  }
}
