import { describe, expect, it } from 'vitest'
import { defaultQuest, normalizeQuest, patchQuest } from './questEntry'

describe('quest entry', () => {
  it('adds an empty optional reward without changing quest content', () => {
    const quest = normalizeQuest({ id: 'quest', title: 'Башня', desc: 'Найти мага', status: 'done' })

    expect(quest).toEqual({
      id: 'quest',
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
