export function adjacentSessionListItemId(items, selectedId, direction) {
	if (!items.length) return null

	const currentIndex = items.findIndex(item => String(item.id) === String(selectedId))
	if (currentIndex < 0) return direction < 0 ? items.at(-1).id : items[0].id

	const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + Math.sign(direction)))
	return items[nextIndex].id
}

export function scrollSessionListItemIntoView(container, id) {
	container?.querySelector(`[data-session-list-id="${id}"]`)?.scrollIntoView({ block: 'nearest' })
}
