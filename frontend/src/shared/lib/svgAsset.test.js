import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ open: vi.fn(), request: vi.fn(), records: new Map() }))
vi.mock('@/platform/storage', () => ({ openLocalDatabase: mocks.open }))
vi.mock('@/shared/api/http', () => ({ fetchGetEmpty: mocks.request }))
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1h22v22H1z"/></svg>'
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); mocks.records.clear()
  mocks.open.mockResolvedValue({ get: async key => mocks.records.get(key), batch: async changes => changes.forEach(({ key, value }) => mocks.records.set(key, value)) })
  mocks.request.mockImplementation(async () => new Response(svg, { headers: { 'content-type': 'image/svg+xml' } }))
})
it('deduplicates lazy requests and persists only the requested SVG', async () => {
  const { loadSvgAsset } = await import('./svgAsset')
  expect(await Promise.all([loadSvgAsset(7), loadSvgAsset(7)])).toEqual([svg, svg])
  expect(mocks.request).toHaveBeenCalledTimes(1)
  expect([...mocks.records.keys()]).toEqual(['public:svg:7'])
  vi.resetModules()
  expect(await (await import('./svgAsset')).loadSvgAsset(7)).toBe(svg)
  expect(mocks.request).toHaveBeenCalledTimes(1)
})
it('rejects invalid IDs and permits retry after a failed request', async () => {
  const { loadSvgAsset } = await import('./svgAsset')
  await expect(loadSvgAsset('../7')).rejects.toThrow('ID')
  expect(mocks.request).not.toHaveBeenCalled()
  mocks.request.mockRejectedValueOnce(new Error('offline'))
  await expect(loadSvgAsset(7)).rejects.toThrow('offline')
  expect(await loadSvgAsset(7)).toBe(svg)
})
it('keeps valid artwork usable if the persistent cache is unavailable', async () => {
  mocks.open.mockRejectedValue(new Error('storage unavailable'))
  expect(await (await import('./svgAsset')).loadSvgAsset(7)).toBe(svg)
})
