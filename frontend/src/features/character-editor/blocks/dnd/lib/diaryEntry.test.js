import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import {
  diaryEventsNewestFirst,
  normalizeCombatant,
  normalizeDiary,
  normalizeDialogueLine,
  normalizeEvent,
  normalizeSession,
  patchEvent,
} from './diaryEntry'

describe('diary entry', () => {
  it('creates isolated editor drafts from Vue proxies, including nested rows', () => {
    const section = reactive({ id: '12', title: 'Раздел', date: '', events: [
      { id: '24', type: 'dialog', title: 'Беседа', desc: '<p>Текст</p>',
        dialogue: [{ id: 'line', speaker: 'NPC', text: 'Привет' }],
        combatants: [{ id: 'enemy', name: 'Волк', count: 1 }] },
    ] })
    const sectionDraft = normalizeSession(section)
    const eventDraft = normalizeEvent(section.events[0])
    sectionDraft.events[0].dialogue[0].speaker = 'Другой'
    eventDraft.combatants[0].name = 'Медведь'
    expect(section.events[0].dialogue[0].speaker).toBe('NPC')
    expect(section.events[0].combatants[0].name).toBe('Волк')
    expect(eventDraft.id).toBe('24')
    expect(sectionDraft.id).toBe('12')
    expect(eventDraft.desc).toBe('<p>Текст</p>')
  })

  it('preserves chronological data and descriptions', () => {
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

  it('normalizes repeatable dialogue lines', () => {
    expect(normalizeDialogueLine({ id: 'line', speaker: 'Мира', text: 'Стойте!' })).toEqual({
      id: 'line',
      speaker: 'Мира',
      text: 'Стойте!',
    })
  })

  it('preserves valid scenario speaker colors through editor drafts and saves', () => {
    const event = reactive({ type: 'dialog', dialogue: [{ speaker: 'Страж', text: 'Стой!', color: '#aAbBcC' }] })
    const draft = normalizeEvent(event)
    expect(patchEvent(draft, { title: 'Ворота' }).dialogue[0].color).toBe('#aAbBcC')
    expect(normalizeDialogueLine({ color: 'url(unsafe)' })).not.toHaveProperty('color')
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

  it('keeps a description while structured data is patched', () => {
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
