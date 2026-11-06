import { expect, it } from 'vitest'
import cases from '../../../native/fixtures/game-mechanics/status-steps.json'
import { ongoingDamageTransition, statusDamageHp } from '@/features/character-editor/lib/statusMechanics'
import { statusRepeatSaveResult } from '@/features/character-editor/lib/statusRepeatSave'

for (const [index, row] of cases.entries()) it(`состояние ${index + 1} · ${row.step} · ${row.phase || 'повторный спасбросок'}`, () => {
  const config = { dice_count: 3, decrease_on_save: 1, save_dc: 12 }
  const params = { damage_phase: row.phase, damage_dice: row.dice ?? 3, save_dc: row.storedDC }
  if (row.step === 'repeat') {
    const result = statusRepeatSaveResult({ dc: row.dc, ability: 3 }, { uid: 'test', params }, { total: row.total })
    expect(result ? { ended: result.ended } : { available: false }).toEqual(row.expect)
    return
  }
  const next = ongoingDamageTransition(config, params, row.step, row.total >= config.save_dc)
  const actual = next ? { phase: next.damage_phase, dice: next.damage_dice } : { ended: true }
  if (row.step === 'damage') {
    const defenses = row.defenses.map(kind => ({ kind, damage_type: 2 }))
    const hp = statusDamageHp({ current: 15, temp: 2 }, row.total, defenses, 2)
    Object.assign(actual, { hp: hp.current, temp: hp.temp })
  }
  expect(actual).toEqual(row.expect)
})
