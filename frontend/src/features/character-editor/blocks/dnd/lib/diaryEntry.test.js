import { describe, expect, it } from 'vitest'
import {
  diaryEventsNewestFirst,
  normalizeCombatant,
  normalizeDiary,
  normalizeDialogueLine,
  patchEvent,
} from './diaryEntry'

describe('diary entry', () => {
  it('preserves chronological legacy data and descriptions', () => {
    const value = [{
      id: 'session',
      title: 'Первая',
      date: '2026-08-11',
      events: [
        { id: 'old', type: 'dialog', title: 'Разговор', desc: '<p>Старый текст</p>' },
        { id: 'new', type: 'battle', title: 'Засада', desc: 'Гоблины' },
      ],
    }]

    const normalized = normalizeDiary(value)

    expect(normalized[0].events.map(event => event.id)).toEqual(['old', 'new'])
    expect(normalized[0].events[0]).toMatchObject({
      desc: '<p>Старый текст</p>',
      dialogue: [],
      combatants: [],
    })
    expect(normalized[0].events[1].desc).toBe('Гоблины')
  })

  it('builds a newest-first display copy without mutating stored chronology', () => {
    const stored = [{ id: 'old' }, { id: 'new' }]

    expect(diaryEventsNewestFirst(stored).map(event => event.id)).toEqual(['new', 'old'])
    expect(stored.map(event => event.id)).toEqual(['old', 'new'])
  })

  it('normalizes repeatable dialogue lines and accepts the legacy name alias', () => {
    expect(normalizeDialogueLine({ id: 'line', name: 'Мира', text: 'Стойте!' })).toEqual({
      id: 'line',
      speaker: 'Мира',
      text: 'Стойте!',
    })
  })

  it('normalizes handbook and custom combatants defensively', () => {
    expect(normalizeCombatant({
      id: 'book',
      count: 3,
      itemId: 42,
      itemName: 'Гоблин',
    })).toMatchObject({ source: 'handbook', count: 3, itemId: 42, itemName: 'Гоблин' })

    expect(normalizeCombatant({
      id: 'custom',
      source: 'custom',
      itemId: 99,
      count: 0,
      name: 'Главарь',
      ac: '-2',
      hp: '17',
      desc: 'В шлеме',
    })).toMatchObject({
      source: 'custom',
      count: 1,
      name: 'Главарь',
      ac: 0,
      hp: 17,
      desc: 'В шлеме',
    })
  })

  it('keeps a legacy description while structured data is patched', () => {
    const event = {
      id: 'dialog',
      type: 'dialog',
      title: '',
      desc: '<p>Не потерять</p>',
      dialogue: [],
      combatants: [],
    }

    const patched = patchEvent(event, {
      dialogue: [{ id: 'line', speaker: 'Страж', text: 'Кто идёт?' }],
    })

    expect(patched.desc).toBe('<p>Не потерять</p>')
    expect(patched.dialogue).toHaveLength(1)
  })
})
