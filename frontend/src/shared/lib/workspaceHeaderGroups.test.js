import { describe, expect, it } from 'vitest'
import { workspaceHeaderGroups } from './workspaceHeaderGroups'
const sizes = { identity: 300, actions: 80, details: 400, context: 220, gap: 12, offset: 16 }
describe('ordered workspace header groups', () => {
  it('moves a whole metric group below identity, then places conditions beside it when they fit', () => {
    expect(workspaceHeaderGroups({ ...sizes, width: 475 })).toEqual({ detailsInline: false, contextInline: false, contextInDetailsRow: false })
    expect(workspaceHeaderGroups({ ...sizes, width: 704 })).toEqual({ detailsInline: false, contextInline: false, contextInDetailsRow: true })
  })
  it('fits metrics before conditions and keeps a separate condition row when the first row is full', () => {
    expect(workspaceHeaderGroups({ ...sizes, width: 1024 })).toEqual({ detailsInline: true, contextInline: false, contextInDetailsRow: false })
    expect(workspaceHeaderGroups({ ...sizes, width: 1440 })).toEqual({ detailsInline: true, contextInline: true, contextInDetailsRow: false })
  })
  it('reserves the inter-group offset at the exact fit boundary', () => {
    expect(workspaceHeaderGroups({ ...sizes, width: 648 }).contextInDetailsRow).toBe(true)
    expect(workspaceHeaderGroups({ ...sizes, width: 647 }).contextInDetailsRow).toBe(false)
  })
  it('preserves the one-context contract for other workspaces and explicit row placement', () => {
    expect(workspaceHeaderGroups({ ...sizes, details: null, width: 704 }).contextInline).toBe(true)
    expect(workspaceHeaderGroups({ ...sizes, details: null, width: 704, placement: 'row' }).contextInline).toBe(false)
    expect(workspaceHeaderGroups({ ...sizes, context: null, width: 704 }).contextInDetailsRow).toBe(false)
  })
})
