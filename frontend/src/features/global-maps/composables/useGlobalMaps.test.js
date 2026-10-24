import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/shared/api/globalMapsApi', () => ({
  getGlobalMaps: api.get, activateGlobalMap: vi.fn(), createGlobalMap: vi.fn(),
  deleteGlobalMap: vi.fn(), saveGlobalMap: vi.fn(),
}))
vi.mock('@/features/maps/composables/useMapSync', () => ({ useMapSync: () => ({ connected: true }) }))
import { useGlobalMaps } from './useGlobalMaps'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', { addEventListener: vi.fn() })
  api.get.mockResolvedValue({ maps: [] })
})
afterEach(() => vi.unstubAllGlobals())

it('initial and background reads preserve a rejected upload until another file is chosen', async () => {
  const c = useGlobalMaps('session')
  let finish
  api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const initial = c.load()
  const oversized = { size: 30 * 1024 * 1024 + 1, type: 'image/png', name: 'large.png' }
  await c.upload(oversized)
  expect(c.error.value).toBe('Файл слишком большой (максимум 30 МБ)')
  finish({ maps: [] })
  await initial
  await c.load()
  expect(c.error.value).toBe('Файл слишком большой (максимум 30 МБ)')
  expect(c.busy.value).toBe(false)
  await c.upload({ size: 0, type: 'image/png', name: 'empty.png' })
  expect(c.error.value).toBe('Выберите непустое изображение')
})

it('a successful refresh clears its read error and a forced reload clears the local error', async () => {
  const c = useGlobalMaps('session')
  api.get.mockRejectedValueOnce(new Error('offline'))
  await expect(c.load()).rejects.toThrow('offline')
  expect(c.error.value).toBe('offline')
  await c.load()
  expect(c.error.value).toBe('')
  c.error.value = 'Local edit failed'
  await c.load(true)
  expect(c.error.value).toBe('')
})
