export function makeUid(seed = 'item') {
  return `${seed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function normalizeList(list, path) {
  return (list || []).map((item, index) => ({
    ...item,
    uid: item.uid || `legacy-${path}-${index}-${item.id}`,
    items: normalizeList(item.items || [], `${path}-${index}`),
  }))
}

export function findEntry(list, uid) {
  for (const item of list || []) {
    if (item.uid === uid) return item
    const found = findEntry(item.items || [], uid)
    if (found) return found
  }
  return null
}

export function allStoredIds(storedList) {
  const ids = new Set()
  const walk = (items) => { for (const s of items || []) { ids.add(s.id); walk(s.items) } }
  walk(storedList)
  return [...ids]
}

export function cloneList(items) {
  return (items || []).map(s => ({ ...s, items: cloneList(s.items || []) }))
}

export function changeCountInList(list, parentUid, itemUid, delta) {
  return (list || []).map(s => {
    if (s.uid === parentUid) return { ...s, items: (s.items || []).map(n => n.uid === itemUid ? { ...n, count: Math.max(1, (n.count ?? 1) + delta) } : n) }
    return { ...s, items: changeCountInList(s.items || [], parentUid, itemUid, delta) }
  })
}

export function setCountInList(list, parentUid, itemUid, count) {
  return (list || []).map(s => {
    if (s.uid === parentUid) return { ...s, items: (s.items || []).map(n => n.uid === itemUid ? { ...n, count } : n) }
    return { ...s, items: setCountInList(s.items || [], parentUid, itemUid, count) }
  })
}

export function removeFromParent(list, parentUid, itemUid) {
  return (list || []).map(s => {
    if (s.uid === parentUid) return { ...s, items: (s.items || []).filter(n => n.uid !== itemUid) }
    return { ...s, items: removeFromParent(s.items || [], parentUid, itemUid) }
  })
}

export function addToParent(list, parentUid, entry) {
  return (list || []).map(s => {
    if (s.uid === parentUid) return { ...s, items: [...(s.items || []), entry] }
    return { ...s, items: addToParent(s.items || [], parentUid, entry) }
  })
}
