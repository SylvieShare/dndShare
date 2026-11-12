export function updateSafePoint(document, pathname, mutations = 0, explicit = false) {
  if (mutations || document.querySelector('[aria-busy="true"],input:invalid,[aria-invalid="true"]')) return false
  if ([...document.querySelectorAll('[role="dialog"],[role="menu"]')].some(element => !element.querySelector('[data-build-version-details]') && !element.querySelector('.desktop-sidebar'))) return false
  if (document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return false
  if (/^\/(?:sessions?|maps|map-screen|screen|world-maps|chars\/new|admin)(?:\/|$)/.test(pathname)) return false
  if (!explicit && pathname.startsWith('/char/')) return false
  return true
}
