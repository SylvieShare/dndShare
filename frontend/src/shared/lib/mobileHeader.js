export const MOBILE_HEADER_FLOW = 'flow'
export const MOBILE_HEADER_COLLAPSIBLE = 'collapsible'

export function resolveMobileHeaderMode(meta) {
  return meta?.mobileHeader === MOBILE_HEADER_COLLAPSIBLE
    ? MOBILE_HEADER_COLLAPSIBLE
    : MOBILE_HEADER_FLOW
}
