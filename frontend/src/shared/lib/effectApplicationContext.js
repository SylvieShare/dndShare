export function effectAppliesIn(link, context) {
  return !link.apply_on || link.apply_on === 'any' || link.apply_on === context
}
