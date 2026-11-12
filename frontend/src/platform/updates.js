import { reactive } from 'vue'
import { registerPlugin } from '@capacitor/core'
import { isAndroid } from './storage'
import { outboxStorage } from './journal'
import { frontendBuild } from './build'
import { updateSafePoint } from './updateSafety'

export const frontendUpdater = registerPlugin('FrontendUpdater')
export const versionState = reactive({ backend: null, serverFrontend: null, serverFresh: false, native: null, error: '', applying: false })
let pendingMutations = 0, filePicker = false, lastBackendCheck = 0
export function trackMutation(delta) { pendingMutations = Math.max(0, pendingMutations + delta) }
export async function checkBackendVersion(force = false) {
  if (!force && Date.now() - lastBackendCheck < 15000) return
  lastBackendCheck = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)
  try {
    const response = await fetch('/api/build-info', { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error('Сервер недоступен')
    const data = await response.json()
    if (!data.backend?.version) return
    versionState.backend = data.backend
    versionState.serverFrontend = data.frontend
    versionState.serverFresh = true
    try { localStorage.setItem('dndshare.backend-build', JSON.stringify(data.backend)) } catch { /* optional diagnostic cache */ }
  } catch { versionState.serverFresh = false }
  finally { clearTimeout(timeout) }
}
export async function initializeUpdates(router) {
  try { versionState.backend = JSON.parse(localStorage.getItem('dndshare.backend-build') || 'null') } catch { /* optional diagnostic cache */ }
  void checkBackendVersion()
  if (isAndroid) {
    await frontendUpdater.addListener('statusChanged', state => { versionState.native = state })
    versionState.native = await frontendUpdater.getStatus()
    await frontendUpdater.ready({ bootToken: versionState.native.bootToken, build: frontendBuild.build, sourceHash: frontendBuild.sourceHash })
  }
  document.addEventListener('click', event => { if (event.target.matches?.('input[type=file]')) filePicker = true }, true)
  for (const name of ['change', 'cancel']) document.addEventListener(name, event => { if (event.target.matches?.('input[type=file]')) filePicker = false }, true)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { void checkBackendVersion(); return }
    if (!isAndroid || !versionState.native) return
    const safe = !filePicker && updateSafePoint(document, router.currentRoute.value.path, pendingMutations)
    void Promise.resolve(outboxStorage()?.flush?.()).then(() => frontendUpdater.checkpoint({ bootToken: versionState.native.bootToken, canReload: safe })).catch(() => {})
  })
  window.addEventListener('online', () => { void checkBackendVersion(true); if (isAndroid) void frontendUpdater.check() })
  const timer = setInterval(() => { if (document.visibilityState === 'visible') void checkBackendVersion() }, 60000)
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true })
}
export async function applyFrontendUpdate() {
  versionState.error = ''
  if (filePicker || !updateSafePoint(document, location.pathname, pendingMutations, true)) {
    versionState.error = 'Закройте форму или завершите текущую операцию перед перезапуском.'
    return
  }
  versionState.applying = true
  try {
    await outboxStorage()?.flush?.()
    await frontendUpdater.apply({ bootToken: versionState.native.bootToken })
  } catch (error) { versionState.error = error.message || 'Не удалось применить обновление.' }
  finally { versionState.applying = false }
}
