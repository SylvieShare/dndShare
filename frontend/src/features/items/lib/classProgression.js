import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { parseAsiLevels, grantedSpellRows, dieFaceOf, avgHitDie } from '@/features/character-editor/blocks/dnd/lib/levelUp'
import { computeSpellSlotPools } from '@/features/character-editor/blocks/dnd/lib/multiclassSpellcasting'
import { spellcastingRulesAt } from '@/features/character-editor/blocks/dnd/lib/spellcastingRules'
import { itemChoices } from './itemChoices'

const rows = value => Array.isArray(value) ? value : []
const atLevel = value => Math.max(1, Number(value) || 1)

function resourceChanges(item, level) {
  return rows(item?.data?.class_resources).flatMap(resource => {
    const start = atLevel(resource.level)
    if (level < start) return []
    const scaling = rows(resource.scaling).filter(row => row.uses != null && atLevel(row.level) <= level)
      .sort((a, b) => Number(b.level) - Number(a.level))
    if (level !== start && !scaling.some(row => Number(row.level) === level)) return []
    const count = scaling[0]?.uses ?? resource.max_use
    if (count == null) return []
    const rest = resource.rollback_short_rest ? 'короткий отдых' : resource.rollback_long_rest ? 'длинный отдых' : ''
    return [`${resource.title || resource.key}: ${count}${rest ? ` · ${rest}` : ''}`]
  })
}

/** Read-only single-class roadmap, using the same bindings and slots as the sheet. */
export function classProgression(classItem, subclass, abilities = []) {
  if (!classItem) return []
  const data = classItem.data || {}
  const subclassLevel = atLevel(data.subclass_level)
  const asiLevels = parseAsiLevels(data.asi_levels)
  const hitDie = dieFaceOf(data.hit_die)
  return Array.from({ length: 20 }, (_, index) => {
    const level = index + 1
    const activeSubclass = level >= subclassLevel ? subclass : null
    const binding = { classId: classItem.id, subclassId: activeSubclass?.id }
    const active = featuresForBinding(abilities, binding, level)
    const features = featuresForBinding(abilities, binding, level, { cumulative: false })
    const choices = []
    if (level === 1) {
      for (const [key, label] of [['skill_choice', 'Выбрать навыки'], ['tool_prof_choice', 'Выбрать инструменты']]) {
        if (data[key]?.count) choices.push({ text: label, count: data[key].count })
      }
    }
    if (Number(data.subclass_level) === level) choices.push({ text: subclass ? `Подкласс: ${subclass.name}` : 'Выбрать подкласс', count: 1 })
    if (asiLevels.includes(level)) choices.push({ text: 'Повышение характеристик или черта (если разрешена мастером)', count: 1 })
    for (const item of active) {
      for (const choice of itemChoices(item)) {
        if (Math.max(atLevel(item.data?.level), atLevel(choice.level)) !== level) continue
        choices.push({
          text: choice.text || item.name, count: choice.count, item,
          options: choice.options.map(option => option.label || option.value).filter(Boolean).join(' · '),
        })
      }
    }
    const improvements = active.flatMap(item => [
      ...rows(item.data?.scaling).filter(row => Number(row.level) === level).map(row => ({
        item, text: [row.value, row.uses != null ? `${row.uses} использ.` : '', row.note].filter(Boolean).join(' · '),
      })),
      ...rows(item.data?.display_scaling).filter(row => Number(row.level) === level && row.label)
        .map(row => ({ item, text: row.label })),
    ]).filter(row => row.text)
    const entry = { id: classItem.id, level, subclass: activeSubclass ? { id: activeSubclass.id } : null }
    const itemMap = { [classItem.id]: classItem, ...(activeSubclass ? { [activeSubclass.id]: activeSubclass } : {}) }
    const slots = computeSpellSlotPools([entry], itemMap)
    const casting = spellcastingRulesAt(activeSubclass, level) || spellcastingRulesAt(classItem, level)
    const previousSubclass = level - 1 >= subclassLevel ? subclass : null
    const previous = level > 1
      ? spellcastingRulesAt(previousSubclass, level - 1) || spellcastingRulesAt(classItem, level - 1)
      : null
    for (const [key, label] of [['cantripsKnown', 'Выбрать заговоры'], ['spellsKnown', 'Выбрать известные заклинания']]) {
      const delta = (casting?.[key] ?? 0) - (previous?.[key] ?? 0)
      if (delta > 0) choices.push({ text: label, count: delta })
    }
    if (level > 1 && casting?.levelUpChoices) choices.push({ text: 'Добавить заклинания при повышении уровня', count: casting.levelUpChoices })
    const sources = [classItem, activeSubclass].filter(Boolean)
    const spellEntries = [...sources, ...active].flatMap(item => grantedSpellRows([item])
      .filter(spell => Math.max(atLevel(item.data?.level), spell.level) === level)
      .map(spell => [`${spell.spellId}:${spell.option || ''}`, spell]))
    const spells = [...new Map(spellEntries).values()]
    return {
      level, proficiency: 2 + Math.floor(index / 4), features, choices, improvements, slots, casting,
      hitPoints: hitDie ? (level === 1 ? `${hitDie} + мод. ТЕЛ` : `1к${hitDie} (или ${avgHitDie(hitDie)}) + мод. ТЕЛ`) : '',
      resources: sources.flatMap(item => resourceChanges(item, level)), spells,
    }
  })
}
