export function gameSystemSlug(name = '') {
  return String(name)
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown'
}

export function gameVersionSlug(version = '') {
  return String(version)
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown'
}

export function isDnd5e2014(context) {
  return String(context?.sourceName).toLocaleLowerCase() === 'dnd5e'
    && String(context?.version) === '2014'
}

export function rulesPathForGameContext(context) {
  if (!context?.sourceName || !context?.version) return '/rules'
  return `/rules/${gameSystemSlug(context.sourceName)}/${gameVersionSlug(context.version)}`
}
