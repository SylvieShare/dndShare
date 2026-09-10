import { describe, expect, it } from 'vitest'
import { normalizeJournalQuest, questProgress } from './journalQuest'
import { normalizeEvent } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'

describe('journal quests', () => {
  it('normalizes quest events without discarding checklist or reward', () => {
    const event = normalizeEvent({ id: 'q', type: 'quest', quest: { reward: 'Карта', objectives: [{ id: 'one', text: 'Ключ', done: true }] } })
    expect(event.type).toBe('quest')
    expect(event.quest.reward).toBe('Карта')
    expect(event.quest.objectives[0]).toEqual({ id: 'one', text: 'Ключ', done: true })
    expect(questProgress(event.quest)).toEqual({ total: 1, done: 1, complete: true, percent: 100 })
  })
  it('does not complete an empty draft and recomputes reopened progress', () => {
    expect(questProgress(normalizeJournalQuest()).complete).toBe(false)
    expect(questProgress(normalizeJournalQuest({ objectives: [{ id: 'one', text: 'Ключ', done: false }] })).percent).toBe(0)
  })
})
