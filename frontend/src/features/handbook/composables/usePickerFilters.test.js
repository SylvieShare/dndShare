import { effectScope, nextTick, reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import { usePickerFilters } from './usePickerFilters'

describe('picker default and fixed filters', () => {
  function setup(input) {
    const props = reactive(input)
    const scope = effectScope()
    const state = scope.run(() => usePickerFilters(props))
    return { props, scope, ...state }
  }

  it('preselects defaults, allows replacement and clearing, and retains original markers', () => {
    const state = setup({ defaultFilters: { 'classes.id': 4014, lvl: [0, 1] } })
    expect(state.filters.value).toEqual({ 'classes.id': [4014], lvl: [0, 1] })
    state.updateFilters({ 'classes.id': [99], lvl: [9] })
    expect(state.filters.value).toEqual({ 'classes.id': [99], lvl: [9] })
    state.updateFilters({})
    expect(state.filters.value).toEqual({})
    expect(state.normalizedDefaultFilters.value).toEqual({ 'classes.id': [4014], lvl: [0, 1] })
    state.resetFilters()
    expect(state.filters.value).toEqual({ 'classes.id': [4014], lvl: [0, 1] })
    state.scope.stop()
  })

  it('preserves mandatory ability filters during edits and clear', async () => {
    const state = setup({ defaultFilters: { lvl: [0, 1] }, fixedFilters: { lvl: 0, ritual: false } })
    state.updateFilters({ lvl: [9], 'classes.id': [99] })
    expect(state.filters.value).toEqual({ lvl: [0], ritual: false, 'classes.id': [99] })
    state.props.fixedFilters = { lvl: 1 }
    await nextTick()
    expect(state.filters.value).toEqual({ lvl: [1], 'classes.id': [99] })
    state.updateFilters({})
    expect(state.filters.value).toEqual({ lvl: [1] })
    state.scope.stop()
  })

  it('does not reapply defaults over user edits on a parent update', async () => {
    const state = setup({ defaultFilters: { lvl: [0, 1] } })
    state.updateFilters({})
    state.props.defaultFilters = { lvl: [0, 1, 2] }
    await nextTick()
    expect(state.filters.value).toEqual({})
    state.resetFilters()
    expect(state.filters.value).toEqual({ lvl: [0, 1, 2] })
    state.scope.stop()
  })
})
