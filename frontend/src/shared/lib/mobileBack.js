export const MOBILE_HEADER_BACK_EVENT = 'dndshare:mobile-header-back'

export function dispatchMobileHeaderBack(windowObject = window) {
  const event = new CustomEvent(MOBILE_HEADER_BACK_EVENT, { cancelable: true })
  windowObject.dispatchEvent(event)
  return event.defaultPrevented
}
