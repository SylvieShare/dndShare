import { describe, expect, it } from 'vitest'
import { classCardSummary, shortClassDescription, subclassCardSummary } from './classCardSummary'

describe('class card summary', () => {
  it('turns handbook html into a compact plain-text description', () => {
    expect(shortClassDescription({ data: { description: '<p>Мастер&nbsp;<b>оружия</b>.</p>' } }))
      .toBe('Мастер оружия.')
  })

  it('collects core class facts, choices and subclass names', () => {
    const summary = classCardSummary({
      charClass: { id: 7, data: {
        hit_die: 'd10', primary_abilities: [1], saves: [1, 3],
        armor_prof: [9], weapon_prof: [14], skill_choice: { from: [1, 2], count: 2 },
        spellcasting: { cantrips_known: 2 }, subclass_level: 1,
      } },
      subclasses: ['Чемпион'],
      suggestValue: (typeId, id) => ({ '3:9': 'Лёгкие доспехи', '4:14': 'Простое оружие' })[`${typeId}:${id}`] || '',
    })

    expect(summary.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Кость хитов', value: 'd10' }),
      expect.objectContaining({ label: 'Ключевые характеристики', value: 'Сила' }),
      expect.objectContaining({ label: 'Владения', value: expect.stringContaining('Лёгкие доспехи') }),
    ]))
    expect(summary.choices).toEqual(['2 навыка', 'заклинания', 'архетип'])
    expect(summary.subclasses).toEqual(['Чемпион'])
  })

  it('keeps level-one ability descriptions for tooltips', () => {
    const summary = classCardSummary({
      charClass: { id: 7, data: {} },
      classAbilities: [{ id: 1, name: 'Второе дыхание', data: { level: 1, class_ids: [{ id: 7 }], desc: '<p>Восстанавливает хиты.</p>' } }],
    })
    expect(summary.facts).toContainEqual(expect.objectContaining({
      label: 'Способности 1 уровня',
      entries: [{ name: 'Второе дыхание', description: '<p>Восстанавливает хиты.</p>' }],
    }))
  })

  it('announces a class tool proficiency choice without granting its broad category', () => {
    const summary = classCardSummary({
      charClass: { id: 4016, data: { tool_prof_choice: { count: 3, from: [319, 322, 326] } } },
      suggestValue: () => '',
    })
    expect(summary.choices).toContain('3 инструмента')
    expect(summary.facts.find((fact) => fact.label === 'Владения')).toBeUndefined()
  })

  it('summarizes only the level-one benefits owned by an archetype', () => {
    const summary = subclassCardSummary({
      subclass: {
        id: 70,
        data: {
          description: '<p>Воин, отточивший критические удары.</p>',
          granted_spells: [{ level: 1, spell: { id: 501 } }],
        },
      },
      charClass: { id: 7 },
      classAbilities: [
        { id: 1, name: 'Второе дыхание', data: { level: 1, class_ids: [{ id: 7 }] } },
        { id: 2, name: 'Улучшенные критические удары', data: { level: 1, class_ids: [{ id: 7 }], subclass_ids: [{ id: 70 }], desc: '<p>Критический удар при 19–20.</p>' } },
        { id: 3, name: 'Поздняя особенность', data: { level: 3, class_ids: [{ id: 7 }], subclass_ids: [{ id: 70 }] } },
        { id: 4, name: 'Другой архетип', data: { level: 1, class_ids: [{ id: 7 }], subclass_ids: [{ id: 71 }] } },
      ],
      spellPool: [{ id: 501, name: 'Щит' }],
    })

    expect(summary.description).toBe('Воин, отточивший критические удары.')
    expect(summary.benefits).toEqual([
      { name: 'Улучшенные критические удары', description: 'Критический удар при 19–20.' },
      { name: 'Заклинания: Щит', description: '' },
    ])
  })
})
