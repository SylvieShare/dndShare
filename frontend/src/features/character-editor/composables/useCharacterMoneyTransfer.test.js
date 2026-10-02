import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { fetchPost } from '@/shared/api/http'
import { useSuggestStore } from '@/stores/suggest'
import { useCharacterMoneyTransfer } from './useCharacterMoneyTransfer'
vi.mock('@/shared/api/http', () => ({ fetchPost: vi.fn(), fetchGet: vi.fn() }))

function setup(owner = true) {
  useSuggestStore().set(17, [{ id: 1, value: 'Золотые' }, { id: 2, value: 'Серебряные' }])
  const data = ref({ values: { money: { amounts: { 1: 20, 2: 0 } } } }), version = ref(3)
  const session = ref({ uuid: 'session' }), recipients = ref([{ charUuid: 'peer' }])
  const transferState = reactive({ busy: false, error: '' }), closePopover = vi.fn()
  const mutate = vi.fn(async action => {
    if (transferState.busy) return false
    transferState.busy = true
    try { version.value = 4; await action(); return true }
    catch (error) { transferState.error = error.message; return false }
    finally { transferState.busy = false }
  })
  const scope = effectScope()
  const controller = scope.run(() => useCharacterMoneyTransfer({ uuid: 'sender', data, session, isOwner: ref(owner), version, recipients, mutate, transferState, closePopover }))
  return { controller, data, version, recipients, closePopover, mutate, scope }
}
beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
describe('character money transfer', () => {
  it('opens currency and amount selection, sends the flushed version and closes on success', async () => {
    const { controller, closePopover, scope } = setup()
    await controller.open({ charUuid: 'peer', name: 'Торин' })
    expect(closePopover).toHaveBeenCalledOnce()
    expect(controller.state.currencyId).toBe('1')
    expect(controller.balance).toBe(20)
    controller.state.amount = '7'
    fetchPost.mockResolvedValue({ event: { id: 1 } })
    expect(await controller.send()).toBe(true)
    expect(fetchPost).toHaveBeenCalledWith('/char/sender/money-transfers', {
      sessionUuid: 'session', recipientCharUuid: 'peer', currencyId: 1, amount: 7, version: 4,
      clientActionId: expect.any(String),
    })
    expect(controller.state.peer).toBeNull()
    scope.stop()
  })
  it.each([0, -1, 21, 1.5, '', 'abc', Number.MAX_SAFE_INTEGER + 1])('rejects invalid or unavailable amount %s', async amount => {
    const { controller, scope } = setup()
    await controller.open({ charUuid: 'peer' })
    controller.state.amount = amount
    expect(controller.canSubmit).toBe(false)
    expect(await controller.send()).toBe(false)
    expect(fetchPost).not.toHaveBeenCalled()
    scope.stop()
  })
  it('retries a lost response with the same key even after the balance has refreshed', async () => {
    const { controller, data, scope } = setup()
    await controller.open({ charUuid: 'peer' })
    controller.state.amount = 20
    fetchPost.mockRejectedValueOnce(new Error('Ответ потерян'))
    expect(await controller.send()).toBe(false)
    const first = fetchPost.mock.calls[0][1]
    data.value.values.money.amounts[1] = 0
    expect(controller.state.error).toBe('Ответ потерян')
    expect(controller.state.peer.charUuid).toBe('peer')
    expect(controller.canSubmit).toBe(true)
    fetchPost.mockResolvedValue({ event: { id: 1 } })
    expect(await controller.send()).toBe(true)
    expect(fetchPost.mock.calls[1][1].clientActionId).toBe(first.clientActionId)
    scope.stop()
  })
  it('blocks repeat clicks and closing during a transfer', async () => {
    const { controller, scope } = setup()
    await controller.open({ charUuid: 'peer' })
    let finish
    fetchPost.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const sending = controller.send()
    expect(controller.busy).toBe(true)
    controller.close()
    expect(controller.state.peer).not.toBeNull()
    expect(await controller.send()).toBe(false)
    finish({ event: { id: 1 } })
    await sending
    expect(fetchPost).toHaveBeenCalledOnce()
    scope.stop()
  })
  it('limits sending to the owner and current recipients', async () => {
    const readonly = setup(false)
    await readonly.controller.open({ charUuid: 'peer' })
    expect(readonly.controller.state.peer).toBeNull()
    readonly.scope.stop()
    const { controller, recipients, scope } = setup()
    await controller.open({ charUuid: 'outside' })
    expect(controller.state.peer).toBeNull()
    await controller.open({ charUuid: 'peer' })
    recipients.value = []
    expect(await controller.send()).toBe(false)
    expect(fetchPost).not.toHaveBeenCalled()
    scope.stop()
  })
})
