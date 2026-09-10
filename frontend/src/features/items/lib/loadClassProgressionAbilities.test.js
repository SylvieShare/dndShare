import { describe, expect, it, vi } from 'vitest'
import { fetchGet } from '@/shared/api/http'
import { loadClassProgressionAbilities } from './loadClassProgressionAbilities'
import { classProgression } from './classProgression'

vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn(), fetchPost: vi.fn(), fetchPut: vi.fn(), fetchDelete: vi.fn() }))

describe('class progression ability loading', () => {
  it('queries object-array owners by .id and places base and subclass abilities on their levels', async () => {
    const bardicInspiration = { id: 100, typeId: 4, name: 'Вдохновение барда', data: { level: 1, class_ids: [{ id: 4016 }] } }
    const combatInspiration = { id: 101, typeId: 4, name: 'Боевое вдохновение', data: { level: 3, class_ids: [{ id: 4016 }], subclass_ids: [{ id: 4159 }] } }
    fetchGet.mockImplementation(async path => {
      const url = new URL(path, 'http://localhost')
      expect(url.searchParams.get('typeId')).toBe('4')
      expect(JSON.parse(url.searchParams.get('filters'))).toEqual({ 'class_ids.id': [4016] })
      return { items: [bardicInspiration, combatInspiration] }
    })
    const { items } = await loadClassProgressionAbilities(4016)
    const bard = { id: 4016, data: { subclass_level: 3 } }
    const base = classProgression(bard, null, items)
    expect(base[0].features).toEqual([bardicInspiration])
    expect(base[2].features).toEqual([])
    const college = classProgression(bard, { id: 4159 }, items)
    expect(college[2].features).toEqual([combatInspiration])
  })
})
