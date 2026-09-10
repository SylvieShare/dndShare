import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useItemMedia } from './useItemMedia'
import { itemsApi } from '@/shared/api/itemsApi'
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { uploadIconImage: vi.fn(), uploadCoverImage: vi.fn(), clearIcon: vi.fn(), clearCover: vi.fn() } }))
afterEach(() => vi.restoreAllMocks())
describe('staged item media', () => {
  it('does not upload before save; retries only the failed slot', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const scope = effectScope(), media = scope.run(() => useItemMedia())
    media.select('icon', { type: 'image/png', size: 10 })
    media.select('cover', { type: 'image/jpeg', size: 12 })
    expect(itemsApi.uploadIconImage).not.toHaveBeenCalled()
    itemsApi.uploadIconImage.mockResolvedValue({ iconImageUrl: '/icon' })
    itemsApi.uploadCoverImage.mockRejectedValueOnce(new Error('temporary')).mockResolvedValue({ coverImageUrl: '/cover' })
    const saved = { id: 42 }
    await expect(media.save(saved)).rejects.toThrow('temporary')
    expect(saved.iconImageUrl).toBe('/icon')
    await media.save(saved)
    expect(itemsApi.uploadIconImage).toHaveBeenCalledTimes(1)
    expect(itemsApi.uploadCoverImage).toHaveBeenCalledTimes(2)
    expect(saved.coverImageUrl).toBe('/cover')
    scope.stop()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
  it('rejects oversized/unsupported files before mutation and removes only the selected slot', async () => {
    const scope = effectScope(), media = scope.run(() => useItemMedia())
    expect(() => media.select('icon', { type: 'image/jpeg', size: 12 })).toThrow()
    expect(() => media.select('cover', { type: 'image/png', size: 6 * 1024 * 1024 })).toThrow()
    media.remove('cover')
    const saved = { id: 42, iconImageUrl: '/icon', coverImageUrl: '/cover' }
    await media.save(saved)
    expect(saved).toMatchObject({ iconImageUrl: '/icon', coverImageUrl: null })
    scope.stop()
  })
})
