import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useCharacterEdition } from './useCharacterEdition'
import { useGameContextStore } from '@/stores/gameContext'
import { fetchPut } from '@/shared/api/http'
vi.mock('@/shared/api/http', () => ({ fetchPut: vi.fn(), fetchGet: vi.fn() }))

function setup(owner = true) {
  const store = useGameContextStore()
  store.ready = true
  store.sourceVersionId = 30
  store.sources = [
    { id: 1, name: 'DND5e', versions: [{ id: 10, version: '2014' }, { id: 20, version: '2024' }] },
    { id: 2, name: 'Vampire: TM', versions: [{ id: 30, version: '20' }] },
  ]
  const version = ref(3), sourceVersionId = ref(10)
  const applyCharacter = vi.fn(result => { version.value = result.version; sourceVersionId.value = result.sourceVersionId })
  const flushSave = vi.fn(async () => { version.value = 4; return true })
  const controller = useCharacterEdition({ uuid: 'char', isOwner: ref(owner), version, sourceVersionId, flushSave, applyCharacter })
  return { controller, store, version, sourceVersionId, flushSave, applyCharacter }
}
beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
describe('character edition switching', () => {
  it('uses the character system, flushes changes, sends latest revision and preserves global choice', async () => {
    const { controller, store, sourceVersionId, applyCharacter } = setup()
    expect(controller.options.map(v => v.id)).toEqual([10, 20])
    controller.show()
    fetchPut.mockResolvedValue({ version: 5, sourceVersionId: 20 })
    expect(await controller.change(20)).toBe(true)
    expect(fetchPut).toHaveBeenCalledWith('/char/char/edition', { version: 4, sourceVersionId: 20, confirmed: true })
    expect(applyCharacter).toHaveBeenCalledOnce()
    expect(sourceVersionId.value).toBe(20)
    expect(controller.open).toBe(false)
    expect(store.sourceVersionId).toBe(30)
  })
  it('does not send edition change when pending saves fail', async () => {
    const { controller, flushSave, sourceVersionId } = setup()
    controller.show(); flushSave.mockResolvedValue(false)
    expect(await controller.change(20)).toBe(false)
    expect(fetchPut).not.toHaveBeenCalled()
    expect(controller.error).toContain('сохранить лист')
    expect(controller.open).toBe(true)
    expect(sourceVersionId.value).toBe(10)
  })
  it('retains edition after conflict and prevents duplicate requests', async () => {
    const { controller, sourceVersionId } = setup()
    let reject
    fetchPut.mockImplementation(() => new Promise((resolve, fail) => { reject = fail }))
    controller.show()
    const pending = controller.change(20)
    await Promise.resolve()
    expect(controller.busy).toBe(true)
    expect(await controller.change(20)).toBe(false)
    reject(Object.assign(new Error('conflict'), { status: 409 }))
    expect(await pending).toBe(false)
    expect(controller.error).toContain('другом окне')
    expect(controller.busy).toBe(false)
    expect(sourceVersionId.value).toBe(10)
  })
  it('rejects current and foreign editions; hides readonly and single-edition systems', async () => {
    const { controller, sourceVersionId } = setup()
    expect(await controller.change(10)).toBe(false)
    expect(await controller.change(30)).toBe(false)
    sourceVersionId.value = 30
    expect(controller.available).toBe(false)
    controller.show(); expect(controller.open).toBe(false)
    expect(setup(false).controller.available).toBe(false)
    expect(fetchPut).not.toHaveBeenCalled()
  })
})
