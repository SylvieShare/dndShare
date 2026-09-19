import { expect, it } from 'vitest'
import { effectAppliesIn } from './effectApplicationContext'

it('separates caster buffs from impact conditions while permitting deliberately shared effects', () => {
  expect(effectAppliesIn({ apply_on: 'cast' }, 'impact')).toBe(false)
  expect(effectAppliesIn({ apply_on: 'impact' }, 'cast')).toBe(false)
  expect(effectAppliesIn({ apply_on: 'impact' }, 'impact')).toBe(true)
  expect(effectAppliesIn({ apply_on: 'any' }, 'impact')).toBe(true)
  expect(effectAppliesIn({}, 'cast')).toBe(true)
  expect(effectAppliesIn({ apply_on: 'invalid' }, 'cast')).toBe(false)
})
