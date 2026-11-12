import { openLocalDatabase } from '@/platform/storage'
import { fetchGetEmpty } from '@/shared/api/http'

const pending = new Map()
const memory = new Map()

export async function rememberSvgAsset(id, svg) {
  if (!/^[1-9]\d*$/.test(String(id)) || !/<svg[\s>]/i.test(svg)) return
  const key = `public:svg:${id}`
  if (memory.get(key) === svg) return
  memory.set(key, svg)
  try { const db = await openLocalDatabase(); await db.batch([{ key, value: svg }]) } catch { /* Artwork remains available in memory. */ }
}

// SVG IDs are public, immutable asset references. Keep only requested icons;
// handbook metadata deliberately does not carry their artwork.
export function loadSvgAsset(id) {
  if (!/^[1-9]\d*$/.test(String(id))) return Promise.reject(new Error('Некорректный ID SVG'))
  const key = `public:svg:${id}`
  if (memory.has(key)) return Promise.resolve(memory.get(key))
  if (pending.has(key)) return pending.get(key)
  const request = (async () => {
    const db = await openLocalDatabase().catch(() => null)
    const saved = db && await db.get(key).catch(() => null)
    if (typeof saved === 'string') { memory.set(key, saved); return saved }
    const response = await fetchGetEmpty(`/svg/${id}`)
    if (!response.headers.get('content-type')?.includes('image/svg+xml')) throw new Error('Сервер не вернул SVG')
    const svg = await response.text()
    if (!/<svg[\s>]/i.test(svg)) throw new Error('Пустая иконка SVG')
    if (db) await db.batch([{ key, value: svg }]).catch(() => {})
    memory.set(key, svg)
    return svg
  })().finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}
