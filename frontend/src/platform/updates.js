import { computed, reactive } from 'vue'
import { registerPlugin } from '@capacitor/core'
import { isAndroid } from './storage'
import { outboxStorage } from './journal'
import { frontendBuild } from './build'
import { updateSafePoint } from './updateSafety'

const frontendUpdater = registerPlugin('FrontendUpdater')
export const versionState = reactive({ native: null, webBuild: 0, applying: false })
export const frontendUpdateReady = computed(() => isAndroid
  ? !!versionState.native?.pending
  : versionState.webBuild > frontendBuild.build)

let pendingMutations = 0, filePicker = false, lastWebCheck = 0
let checkingWeb = false
export function trackMutation(delta) { pendingMutations = Math.max(0, pendingMutations + delta) }

async function checkWebUpdate(force = false) {
  if (checkingWeb || (!force && Date.now() - lastWebCheck < 15000)) return
  lastWebCheck = Date.now()
  checkingWeb = true
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)
  try {
    const response = await fetch('/api/build-info', { cache: 'no-store', signal: controller.signal })
    const { frontend } = response.ok ? await response.json() : {}
    versionState.webBuild = navigator.onLine && Number.isSafeInteger(frontend?.build) ? frontend.build : 0
  } catch {
    versionState.webBuild = 0
  } finally {
    clearTimeout(timeout)
    checkingWeb = false
  }
}

export async function initializeUpdates(router) {
  if (isAndroid) {
    await frontendUpdater.addListener('statusChanged', state => { versionState.native = state })
    versionState.native = await frontendUpdater.getStatus()
    await frontendUpdater.ready({ bootToken: versionState.native.bootToken, build: frontendBuild.build, sourceHash: frontendBuild.sourceHash })
    window.addEventListener('online', () => { void frontendUpdater.check().catch(() => {}) })
  } else {
    void checkWebUpdate()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void checkWebUpdate() }, 60000)
    window.addEventListener('pagehide', event => { if (!event.persisted) clearInterval(timer) })
    window.addEventListener('online', () => { void checkWebUpdate(true) })
    window.addEventListener('offline', () => { versionState.webBuild = 0 })
  }

  document.addEventListener('click', event => { if (event.target.matches?.('input[type=file]')) filePicker = true }, true)
  for (const name of ['change', 'cancel']) document.addEventListener(name, event => { if (event.target.matches?.('input[type=file]')) filePicker = false }, true)
  document.addEventListener('visibilitychange', () => {
    if (!isAndroid) {
      if (document.visibilityState === 'visible') void checkWebUpdate()
      return
    }
    if (document.visibilityState === 'visible' || !versionState.native) return
    const safe = !versionState.applying && !filePicker && updateSafePoint(document, router.currentRoute.value.path, pendingMutations)
    void Promise.resolve(outboxStorage()?.flush?.()).then(() => frontendUpdater.checkpoint({ bootToken: versionState.native.bootToken, canReload: safe })).catch(() => {})
  })
}

const blockedUpdate = 'Закройте форму или завершите текущую операцию перед перезапуском.'
const canApply = () => !filePicker && updateSafePoint(document, location.pathname, pendingMutations, true)

export async function applyFrontendUpdate() {
  if (!frontendUpdateReady.value || versionState.applying) return
  if (!canApply()) return blockedUpdate

  versionState.applying = true
  try {
    await outboxStorage()?.flush?.()
    if (!frontendUpdateReady.value) return
    if (!canApply()) return blockedUpdate
    if (isAndroid) await frontendUpdater.apply({ bootToken: versionState.native.bootToken })
    else location.reload()
  } catch (error) {
    return error.message || 'Не удалось применить обновление.'
  } finally {
    versionState.applying = false
  }
}
