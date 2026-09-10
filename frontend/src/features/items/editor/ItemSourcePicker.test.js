import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import ItemSourcePicker from './ItemSourcePicker.vue'
import { isSourceSelected, selectAllSources, toggleSourceSelection } from './sourceSelection'

const sources = [{ id: 1, name: 'PHB' }, { id: 2, name: 'Tasha' }]

describe('shared publication source picker', () => {
  it('selects the whole list and clears it', () => {
    expect(selectAllSources(sources, true)).toEqual([1, 2])
    expect(selectAllSources(sources, false)).toEqual([])
    const template = readFileSync(new URL('./ItemSourcePicker.vue', import.meta.url), 'utf8')
    expect(template).toContain('selectAllSources(props.sources, checked)')
    expect(template).toContain("someSelected && !allSelected ? 'mixed' : allSelected")
  })

  it('handles string ids and materializes dynamic all-mode when excluding a book', () => {
    expect(isSourceSelected(['1'], 1)).toBe(true)
    expect(toggleSourceSelection(sources, ['1'], 1)).toEqual([])
    expect(toggleSourceSelection(sources, [], 1, true)).toEqual([2])
    expect(toggleSourceSelection(sources, [1], 2)).toEqual([1, 2])
  })

  it('renders the embedded list without opening another dialog', async () => {
    const html = await renderToString(createSSRApp(ItemSourcePicker, { sources, embedded: true, useAll: true }))
    expect(html).toContain('Выбрать все')
    expect(html).toContain('PHB')
    expect(html).toContain('Tasha')
    expect(html).toContain('checked')
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain('ability-source-trigger')
  })

  it('shows the shared compact trigger for character all-mode', async () => {
    const html = await renderToString(createSSRApp(ItemSourcePicker, { sources, useAll: true }))
    expect(html).toContain('Все источники')
    expect(html).toContain('ability-source-trigger')
  })
})
