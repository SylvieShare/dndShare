import { describe, expect, it } from 'vitest'
import { choicePresentation } from './choicePresentation'

describe('choicePresentation', () => {
  it('shows skill suggestions as checkbox cards', () => {
    expect(choicePresentation({ from_suggest_id: 15 })).toBe('list')
  })

  it('keeps language suggestions in the searchable selector', () => {
    expect(choicePresentation({ from_suggest_id: 6 })).toBe('language')
  })

  it('keeps other suggestion dictionaries as chips', () => {
    expect(choicePresentation({ from_suggest_id: 16 })).toBe('chips')
  })
})
