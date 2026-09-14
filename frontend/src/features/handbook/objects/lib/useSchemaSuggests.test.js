import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { suggestItemIndex } from './useSchemaSuggests'

describe('shared suggest indexes', () => {
  it('reuses an index across rows and invalidates it on reactive mutations', () => {
    const items = reactive([{ id: 1, value: 'Огонь' }])
    const first = suggestItemIndex(items)
    expect(suggestItemIndex(items)).toBe(first)
    expect(first.get('1')).toBe(items[0])
    items.push({ id: 2, value: 'Холод' })
    expect(suggestItemIndex(items)).not.toBe(first)
    expect(suggestItemIndex(items).get('2').value).toBe('Холод')
    items[0].id = 3
    expect(suggestItemIndex(items).has('1')).toBe(false)
    expect(suggestItemIndex(items).get('3')).toBe(items[0])
    items.splice(0)
    expect(suggestItemIndex(items).size).toBe(0)
    items.push({ id: 4, value: 'Гром' })
    expect(suggestItemIndex(items).has('4')).toBe(true)
  })
  it('does not mix separate catalogs or mutate previous indexes', () => {
    const first = reactive([{ id: 1, value: 'А' }]), second = reactive([{ id: 1, value: 'Б' }])
    expect(suggestItemIndex(first).get('1').value).toBe('А')
    expect(suggestItemIndex(second).get('1').value).toBe('Б')
  })
})
