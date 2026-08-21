import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchGet } = vi.hoisted(() => ({ fetchGet: vi.fn() }))

vi.mock('@/shared/api/http', () => ({
  fetchDelete: vi.fn(),
  fetchGet,
  fetchPost: vi.fn(),
  fetchPut: vi.fn(),
}))

const { itemsApi } = await import('./itemsApi')

describe('itemsApi.listAll', () => {
  beforeEach(() => fetchGet.mockReset())

  it('loads every page and keeps handbook scope and filters', async () => {
    const firstPage = Array.from({ length: 500 }, (_, id) => ({ id }))
    const secondPage = [{ id: 500 }, { id: 501 }]
    fetchGet
      .mockResolvedValueOnce({ items: firstPage })
      .mockResolvedValueOnce({ items: secondPage })

    const response = await itemsApi.listAll(5, {
      sourceVersionId: 1,
      contentSources: { mode: 'all', ids: [], allowLegacy: false },
    }, {
      'classes.id': [4020],
      lvl: [0, 1],
    })

    const filters = encodeURIComponent(JSON.stringify({ 'classes.id': [4020], lvl: [0, 1] }))
    expect(fetchGet).toHaveBeenNthCalledWith(1, `/items?typeId=5&limit=500&offset=0&filters=${filters}&sourceVersionId=1`)
    expect(fetchGet).toHaveBeenNthCalledWith(2, `/items?typeId=5&limit=500&offset=500&filters=${filters}&sourceVersionId=1`)
    expect(response.items).toHaveLength(502)
  })
})
