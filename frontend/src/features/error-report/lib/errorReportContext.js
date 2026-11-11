import { layoutTokens } from '@/app/design-tokens'

export function platformForViewport(width) {
  if (Number(width) < layoutTokens.tablet) return 'mobile'
  return Number(width) < layoutTokens.desktop ? 'tablet' : 'desktop'
}
