export function makeUid(seed = 'item') {
  return `${seed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
