import { layoutTokens, spacingTokens } from '../../../app/design-tokens.js'

export const encounterPrimaryWidth = layoutTokens['encounter-roster-width'] + layoutTokens['encounter-scroll-gap']
export const encounterColumnsMinWidth = layoutTokens['encounter-roster-min-width'] + layoutTokens['encounter-scroll-gap'] + layoutTokens['encounter-controls-min-width'] + spacingTokens.large

export function encounterColumnsFit(width) {
  return Number.isFinite(width) && width >= encounterColumnsMinWidth
}
