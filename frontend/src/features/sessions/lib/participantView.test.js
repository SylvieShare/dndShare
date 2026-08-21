import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/character-editor/settings', () => ({
  settingAccessors: () => ({ avatar: () => 'portrait.webp' }),
}))
vi.mock('@/stores/template', () => ({
  useTemplateStore: () => ({ byId: () => ({ name: 'DND5' }) }),
}))

import { pvAvatar } from './participantView'

describe('participant avatar projection', () => {
  it('prefers the independent character icon', () => {
    expect(pvAvatar({ templateId: 1, data: {}, iconImageUrl: 'icon.webp' })).toBe('icon.webp')
  })

  it('falls back to the setting portrait', () => {
    expect(pvAvatar({ templateId: 1, data: {} })).toBe('portrait.webp')
  })
})
