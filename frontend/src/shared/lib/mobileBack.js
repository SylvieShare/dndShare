const HANDBOOK_ROUTES = new Set(['Handbook', 'HandbookObjects', 'HandbookDictionary'])

export function resolveMobileBackTarget(route) {
  if (!route) return null

  if (HANDBOOK_ROUTES.has(String(route.name))) {
    if (route.query?.item != null) {
      const { item: _item, ...query } = route.query
      return { name: route.name, query }
    }
    if (route.query?.type != null) return { name: route.name, query: {} }
  }

  const configured = route.meta?.mobileBackTo
  if (typeof configured === 'function') return configured(route)
  return configured ?? null
}
