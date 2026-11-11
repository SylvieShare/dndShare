import { isAndroid, nativeStore } from './storage'
import { outboxStorage } from './journal'
import { initializeCoverDisplay } from './coverDisplay'

export function installAndroidLifecycle(router) {
  if (!isAndroid) return
  document.documentElement.dataset.platform = 'android'
  void initializeCoverDisplay().catch(() => {})
  window.print = () => { void nativeStore.print() }
  async function download(anchor) {
    try {
      const response = await fetch(anchor.href)
      if (!response.ok) throw new Error('Не удалось получить файл')
      const blob = await response.blob()
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      await nativeStore.saveFile({ name: anchor.download || 'dndshare-export', mime: blob.type || 'application/octet-stream', base64: data })
    } catch (error) { window.dispatchEvent(new CustomEvent('dndshare:platform-error', { detail: error.message })) }
  }
  const originalClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download')) void download(this)
    else originalClick.call(this)
  }
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[download]')
    if (anchor) { event.preventDefault(); void download(anchor) }
  }, true)
  window.addEventListener('dndshare:back', async () => {
    const editor = document.activeElement
    if (editor?.matches('input,textarea,[contenteditable=true]')) { editor.blur(); return }
    // All shared floating surfaces already implement Escape with top-layer ownership.
    if (document.querySelector('[role="dialog"], [role="menu"], .app-drawer--open')) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      return
    }
    if (router.options.history.state.back) router.back()
    else { await outboxStorage().flush(); await nativeStore.exit() }
  })
}
