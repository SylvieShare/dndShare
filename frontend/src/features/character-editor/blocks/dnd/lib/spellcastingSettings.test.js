import { describe, expect, it } from 'vitest'

import { loadSpellcastingSettings, serializeSpellcastingSettings, spellcastingSetting } from './spellcastingSettings'

const sources = [
  { key: 'class:1:', ability: 5, prepares: true },
  { key: 'class:2:', ability: 4, prepares: false },
]

describe('spellcasting settings by source', () => {
  it('migrates global bonuses while keeping class abilities and preparation rules', () => {
    const settings = loadSpellcastingSettings({
      stat_path: 6,
      save_bonus: 2,
      attack_bonus: 1,
      preparation: true,
    }, sources)

    expect(settings['class:1:']).toEqual({ stat_path: 5, save_bonus: 2, attack_bonus: 1, preparation: true })
    expect(settings['class:2:']).toEqual({ stat_path: 4, save_bonus: 2, attack_bonus: 1, preparation: false })
    expect(settings.other).toEqual({ stat_path: 6, save_bonus: 2, attack_bonus: 1, preparation: true })
  })

  it('uses handbook defaults for a newly added class without overwriting explicit values', () => {
    const settings = loadSpellcastingSettings({
      source_settings: { 'class:1:': { stat_path: 6, preparation: false } },
    }, sources)

    expect(spellcastingSetting(settings, 'class:1:', sources)).toMatchObject({ stat_path: 6, preparation: false })
    expect(spellcastingSetting(settings, 'class:2:', sources)).toMatchObject({ stat_path: 4, preparation: false })
    expect(serializeSpellcastingSettings(settings, sources)).toHaveProperty('other')
  })
})
