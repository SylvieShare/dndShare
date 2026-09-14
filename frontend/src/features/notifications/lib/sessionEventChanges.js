function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}

// Actor media and user profiles can refresh without changing the game event.
export function sessionEventSignature(event) {
  return JSON.stringify(canonical({ type: event.type, action: event.action, data: event.data }))
}
