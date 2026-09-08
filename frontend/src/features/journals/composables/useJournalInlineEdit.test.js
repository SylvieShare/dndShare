import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useJournalInlineEdit } from './useJournalInlineEdit'
vi.mock('vue', async original => ({ ...await original(), onBeforeUnmount: vi.fn() }))
function setup() {
  const props = reactive({ event: { id: '1', type: 'dialog', title: 'До', changedAt: 'v1' }, editable: true, busy: false, locked: false, saveEvent: vi.fn().mockResolvedValue({}) })
  const emit = vi.fn()
  return { props, emit, ...useJournalInlineEdit(props, emit) }
}
describe('inline journal drafts', () => {
  it('isolates nested row edits and supports cancelling without saving', () => {
    const state = setup()
    const line = reactive({ id: 'line', speaker: 'Страж', text: 'Стой!' })
    state.start('dialogue', line)
    state.editor.value.value.text = 'Идите'
    expect(line.text).toBe('Стой!')
    state.cancel()
    expect(state.editor.value).toBeNull()
    expect(state.props.saveEvent).not.toHaveBeenCalled()
  })
  it('retains a failed draft and sends its original version, not a newer poll version', async () => {
    const state = setup()
    state.start('title', 'До')
    state.editor.value.value = 'Моя правка'
    state.props.event.changedAt = 'v2'
    state.props.saveEvent.mockRejectedValueOnce(new Error('Конфликт'))
    await state.submit({ title: state.editor.value.value })
    expect(state.props.saveEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Моя правка', expectedChangedAt: 'v1' }))
    expect(state.editor.value.value).toBe('Моя правка')
    expect(state.error.value).toBe('Конфликт')
    expect(state.saving.value).toBe(false)
  })
  it('closes only after successful persistence and blocks duplicate saves', async () => {
    const state = setup()
    state.start('title', 'До')
    let resolve
    state.props.saveEvent.mockReturnValueOnce(new Promise(done => { resolve = done }))
    const pending = state.submit({ title: 'После' })
    await state.submit({ title: 'Лишняя правка' })
    state.cancel()
    expect(state.editor.value).not.toBeNull()
    expect(state.props.saveEvent).toHaveBeenCalledTimes(1)
    resolve({})
    await pending
    expect(state.editor.value).toBeNull()
    expect(state.emit).toHaveBeenLastCalledWith('editing', false)
  })
  it('does not open for read-only or locked events', () => {
    const state = setup()
    state.props.editable = false
    state.start('title', 'Нет')
    expect(state.editor.value).toBeNull()
    state.props.editable = true
    state.props.locked = true
    state.start('title', 'Нет')
    expect(state.editor.value).toBeNull()
  })
})
