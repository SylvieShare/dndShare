import { getSessionImages } from '@/shared/api/sessionsApi'

const cache = new Map()
const pending = new Map()

export async function loadSessionImageCatalog(scope) {
  if (cache.has(scope)) return cache.get(scope)
  if (pending.has(scope)) return pending.get(scope)
  const request = getSessionImages(scope)
    .then(response => {
      const images = response?.images || []
      cache.set(scope, images)
      pending.delete(scope)
      return images
    })
    .catch(error => {
      pending.delete(scope)
      throw error
    })
  pending.set(scope, request)
  return request
}

export function clearSessionImageCatalogCache() {
  cache.clear()
  pending.clear()
}
