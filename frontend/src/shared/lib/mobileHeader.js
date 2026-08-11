export const MOBILE_HEADER_FLOW = 'flow'
export const MOBILE_HEADER_COLLAPSIBLE = 'collapsible'
export const MOBILE_HEADER_HIDDEN = 'hidden'

export function resolveMobileHeaderMode(meta) {
  if (meta?.mobileHeader === MOBILE_HEADER_HIDDEN) return MOBILE_HEADER_HIDDEN
  return meta?.mobileHeader === MOBILE_HEADER_COLLAPSIBLE
    ? MOBILE_HEADER_COLLAPSIBLE
    : MOBILE_HEADER_FLOW
}
