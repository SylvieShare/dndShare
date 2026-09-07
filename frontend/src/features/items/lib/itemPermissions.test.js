import { describe, expect, it } from 'vitest'
import { canEditHandbookItem, canSelectItemPublication } from './itemPermissions'

const account = (id, roles = [], authStatus = 'success') => ({ authStatus, user: { id, roles } })

describe('handbook item editing permissions', () => {
  it('allows an administrator or the exact author to edit', () => {
    expect(canEditHandbookItem({ id: 4167, userId: null }, account(1, ['ADMIN']))).toBe(true)
    expect(canEditHandbookItem({ id: 4167, userId: null }, account(1, ['HANDBOOK_ADMIN']))).toBe(true)
    expect(canEditHandbookItem({ id: 4167, userId: 2 }, account('2'))).toBe(true)
    expect(canEditHandbookItem({ id: 4167, userId: 2 }, account(3))).toBe(false)
    expect(canEditHandbookItem({ id: 4167, userId: null }, account(2))).toBe(false)
  })

  it('does not expose editing to guests or before an item loads', () => {
    expect(canEditHandbookItem({ userId: 1 }, account(1, ['ADMIN'], 'none'))).toBe(false)
    expect(canEditHandbookItem(null, account(1, ['ADMIN']))).toBe(false)
  })

  it('only asks for publications when editing existing base content', () => {
    expect(canSelectItemPublication(null)).toBe(false)
    expect(canSelectItemPublication({ id: 10, userId: 2 })).toBe(false)
    expect(canSelectItemPublication({ id: 10, userId: null })).toBe(true)
  })
})
