import { describe, expect, it } from 'vitest'
import { defaultQuest, normalizeQuest, patchQuest } from './questEntry'

describe('quest entry', () => {
  it('adds an empty reward to legacy quest data without changing its content', () => {
    const quest = normalizeQuest({ id: 'legacy', title: 'Башня', desc: 'Найти мага', status: 'done' })

    expect(quest).toEqual({
      id: 'legacy',
      title: 'Башня',
      desc: 'Найти мага',
      reward: '',
      status: 'done',
    })
  })

  it('creates and patches the dedicated reward field', () => {
    expect(defaultQuest().reward).toBe('')
    expect(patchQuest(defaultQuest(), { reward: '50 зм' }).reward).toBe('50 зм')
  })
})
