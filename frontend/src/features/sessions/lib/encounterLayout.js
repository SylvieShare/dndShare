import { layoutTokens, spacingTokens } from '../../../app/design-tokens.js'

export const encounterPrimaryWidth = layoutTokens['encounter-roster-width'] + layoutTokens['encounter-scroll-gap']
export const encounterColumnsMinWidth = encounterPrimaryWidth + layoutTokens['encounter-preview-min-width'] + spacingTokens.large

export function encounterPreviewFits(width) {
  return Number.isFinite(width) && width >= encounterColumnsMinWidth
}
