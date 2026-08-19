import { describe, expect, it } from 'vitest'
import { groupContentSources } from './contentSourceKinds'

describe('content source categories', () => {
  it('groups sources in catalogue order and keeps core books canonical', () => {
    const groups = groupContentSources([
      { id: 3, code: 'DMG', name: 'Руководство мастера', kind: 'core' },
      { id: 5, code: 'COS', name: 'Проклятье Страда', kind: 'adventure' },
      { id: 1, code: 'PHB', name: 'Книга игрока', kind: 'core' },
      { id: 4, code: 'UA22GO', name: 'Unearthed Arcana', kind: 'playtest' },
      { id: 2, code: 'MM', name: 'Бестиарий', kind: 'core' },
    ])

    expect(groups.map(group => group.kind)).toEqual(['core', 'adventure', 'playtest'])
    expect(groups[0].sources.map(source => source.code)).toEqual(['PHB', 'MM', 'DMG'])
  })
})
