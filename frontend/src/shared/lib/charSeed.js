// Short-lived seed of a character, captured from the list tile so the editor
// page can render instantly without re-fetching /char/:uuid. The list endpoint
// already returns everything the page needs (data, version, userId,
// publicVisible, templateId); the template schema comes from the template store.

const seeds = new Map()
const TTL_MS = 30_000

export function setCharSeed(uuid, payload) {
  if (!uuid || !payload) return
  const key = String(uuid)
  const entry = { payload, timer: null }
  entry.timer = setTimeout(() => {
    if (seeds.get(key) === entry) seeds.delete(key)
  }, TTL_MS)
  seeds.set(key, entry)
}

export function consumeCharSeed(uuid) {
  const key = String(uuid)
  const entry = seeds.get(key)
  if (!entry) return null
  if (entry.timer) clearTimeout(entry.timer)
  seeds.delete(key)
  return entry.payload
}
