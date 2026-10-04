import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDiceStore } from './dice'
import { useSessionEventsStore } from './sessionEvents'
import { useNotificationsStore } from './notifications'
import * as api from '@/shared/api/sessionDiceApi'

beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers() })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

function session() {
  const events = useSessionEventsStore()
  events.sessionUuid = 'game'
  events.actorCharUuid = 'hero'
  vi.spyOn(events, 'publish').mockResolvedValue(null)
  return events
}

describe('session d20 rolls', () => {
  it('uses the server faces, keeps advantage and rolls blessing normally', async () => {
    session()
    const server = vi.spyOn(api, 'rollSessionD20').mockResolvedValue({ rolls: [3, 18], karmic: true, balanceBefore: 3, balanceAfter: 2 })
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const dice = useDiceStore()
    const result = await dice.rollD20('Атака', 4, 'advantage', { roll_kind: 'attack', bonus_formula: '1d4', crit_mode: true })
    expect(server).toHaveBeenCalledWith('game', expect.objectContaining({ charUuid: 'hero', kind: 'attack', mode: 'advantage' }))
    expect(result.parts[0]).toMatchObject({ rolls: [3, 18], sum: 18, keptIndex: 1, dropped: [0] })
    expect(result.total).toBe(23)
    expect(result.karmicDice).toEqual({ before: 3, after: 2 })
    dice.clear()
  })

  it('uses the NPC identity independently of the open sheet and preserves a natural one', async () => {
    session()
    const server = vi.spyOn(api, 'rollSessionD20').mockResolvedValue({ rolls: [1], karmic: true, balanceBefore: 0, balanceAfter: 1 })
    const dice = useDiceStore()
    const result = await dice.rollD20('Спасбросок', 3, 'normal', { roll_kind: 'saving_throw', actor: { name: 'Гоблин' }, eventData: { npcActor: { uid: 'goblin' } }, crit_mode: true })
    expect(server.mock.calls[0][1]).toMatchObject({ npcUid: 'goblin', kind: 'saving_throw' })
    expect(server.mock.calls[0][1].charUuid).toBeUndefined()
    expect(result.total).toBe(4)
    expect(dice.stack[0].outcome).toEqual({ kind: 'fumble', sides: 20, value: 1 })
    dice.clear()
  })

  it('leaves initiative, damage, free d20 and rolls without a session local', () => {
    const server = vi.spyOn(api, 'rollSessionD20')
    const dice = useDiceStore()
    expect(dice.rollD20('Проверка', 0, 'normal', { roll_kind: 'ability_check' }).total).toBeGreaterThan(0)
    session()
    expect(dice.rollD20('Инициатива', 2).total).toBeGreaterThan(0)
    dice.roll('Урон', '1d8')
    dice.roll('d20', 'd20')
    expect(server).not.toHaveBeenCalled()
    dice.clear()
  })

  it('does not invent a local result or publish it after a server failure', async () => {
    const events = session()
    vi.spyOn(api, 'rollSessionD20').mockRejectedValue(new Error('offline'))
    const dice = useDiceStore()
    expect(await dice.rollD20('Атака', 0, 'normal', { roll_kind: 'attack' })).toBeNull()
    expect(events.publish).not.toHaveBeenCalled()
    expect(dice.stack).toHaveLength(0)
    expect(useNotificationsStore().entries[0].title).toContain('Не удалось')
  })

  it('rerolls through the server and requests only one extra die for encounter advantage', async () => {
    session()
    const server = vi.spyOn(api, 'rollSessionD20').mockResolvedValue({ rolls: [20], karmic: false })
    const dice = useDiceStore()
    const onReroll = vi.fn()
    await dice.rollD20('Атака', 2, 'normal', { roll_kind: 'attack', onReroll, roll_triggers: [{ action: 'reroll', event: 'any' }] })
    await dice.runAction(dice.stack[0].id, 'reroll')
    expect(server).toHaveBeenCalledTimes(2)
    expect(onReroll).toHaveBeenCalledWith(expect.objectContaining({ total: 22 }))
    await dice.rollExtraD20('advantage', 12, { roll_kind: 'ability_check', actor: { charUuid: 'hero' } })
    expect(server.mock.calls[2][1]).toMatchObject({ previous: 12, mode: 'advantage' })
    dice.clear()
  })

  it('discards a response after switching sheets', async () => {
    const events = session()
    let finish
    vi.spyOn(api, 'rollSessionD20').mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const dice = useDiceStore(), pending = dice.rollD20('Проверка', 0, 'normal', { roll_kind: 'ability_check' })
    events.actorCharUuid = 'other'
    finish({ rolls: [20], karmic: false })
    expect(await pending).toBeNull()
    expect(events.publish).not.toHaveBeenCalled()
  })
})
