import { describe, expect, it } from 'vitest'
import { adjacentSessionListItemId } from './sessionListNavigation'

const items = [{ id: 10 }, { id: 20 }, { id: 30 }]

describe('session list navigation', () => {
	it('moves to adjacent items and stops at list boundaries', () => {
		expect(adjacentSessionListItemId(items, 20, -1)).toBe(10)
		expect(adjacentSessionListItemId(items, 20, 1)).toBe(30)
		expect(adjacentSessionListItemId(items, 10, -1)).toBe(10)
		expect(adjacentSessionListItemId(items, 30, 1)).toBe(30)
	})

	it('starts at the appropriate edge when the selection is outside the filtered list', () => {
		expect(adjacentSessionListItemId(items, 99, 1)).toBe(10)
		expect(adjacentSessionListItemId(items, 99, -1)).toBe(30)
		expect(adjacentSessionListItemId([], null, 1)).toBeNull()
	})
})
