import { ref, watch, onBeforeUnmount } from 'vue'
import { getActivePinia } from 'pinia'
import { useAccountStore } from '@/stores/account'
import { fetchGet, fetchPatch } from '@/shared/api/http'
import { createDocumentSync } from '@/shared/lib/documentSync'
import { documentDiff, applyDocumentPatches } from '@/shared/lib/documentPatch'
import { finishDocumentSync } from '@/shared/lib/finishDocumentSync'

const SAVE_DELAY_MS = 400
const urgentFields = new Set([
  'hp',
  'health',
  'states',
  'conditions',
  'exhaustion',
  'slot_pools',
])

export function useSaveDebounce(uuid, data, options = {}) {
  const historyState = ref({ canUndo: false, canRedo: false })
  const saveStatus = ref('idle'),
    saveError = ref(''),
    pendingSecondsLeft = ref(0)
  const storageKey = () => {
    const actor = getActivePinia() ? useAccountStore().user?.id : null
    return actor
      ? `dndshare.document-pending.v1.character:${actor}:${uuid}`
      : null
  }
  let timer,
    initialized = options.serverDocument
      ? !!options.serverDocument.value
      : !!options.version?.value
  function applyData(next) {
    next = { values: {}, var: {}, ...next }
    const current = data.value
    const result = applyDocumentPatches(current, documentDiff(current, next))
    if (result !== current) data.value = result
  }
  const sync = createDocumentSync({
    data: options.serverDocument?.value?.data || data.value,
    version: options.version?.value || 0,
    restore: false,
    storageKey,
    send: (packet) =>
      fetchPatch(`/char/${encodeURIComponent(uuid)}/data`, packet),
    load: (version) =>
      fetchGet(`/char/${encodeURIComponent(uuid)}/changes?after=${version}`),
    onData: applyData,
    onAck: (response) => {
      if (options.version) options.version.value = response.version
    },
    onRemote: (response) => {
      if (options.version) options.version.value = response.version
      options.onMetadata?.(response.metadata)
    },
    onStatus(state) {
      historyState.value = { canUndo: state.canUndo, canRedo: state.canRedo }
      saveStatus.value =
        state.status === 'conflict'
          ? 'error'
          : state.status === 'retrying'
            ? 'pending'
            : state.status
      pendingSecondsLeft.value = state.status === 'pending' ? 1 : 0
      saveError.value =
        state.error && state.status !== 'retrying'
          ? state.status === 'conflict'
            ? 'Лист изменился на сервере. Несохранённые правки сохранены в этом браузере; конфликтующие поля требуют проверки.'
            : state.error.message || 'Не удалось сохранить изменения.'
          : ''
    },
  })
  const stopVersion = options.version
    ? watch(
        () => [options.version.value, options.serverDocument?.value],
        ([version, snapshot]) => {
          if (!initialized) {
            // A live roster can advance version before the initial GET arrives.
            // Only the loaded snapshot proves that the sheet is ready to save.
            if (options.serverDocument && !snapshot) return
            const loadedVersion = snapshot?.version ?? version
            const newerLive = sync.version > loadedVersion
            sync.reset(
              newerLive ? sync.confirmed : snapshot?.data || data.value,
              newerLive ? sync.version : loadedVersion,
              { preserveOutbox: true },
            )
            initialized = true
            applyData(sync.data)
            options.version.value = sync.version
          } else {
            if (
              version === sync.version &&
              (!snapshot || snapshot.version <= version)
            )
              return
            sync.receive(snapshot || { data: data.value, version })
            if (snapshot) options.version.value = sync.version
          }
        },
        { flush: 'sync' },
      )
    : () => {}
  let recoveryStarted = false
  const stopReady = watch(
    () => [options.version?.value, options.serverDocument?.value, options.canSave?.() ?? true],
    () => {
      if (!initialized || recoveryStarted || !(options.canSave?.() ?? true)) return
      recoveryStarted = true
      void sync.restorePending().then(() => {
        applyData(sync.data)
        if (options.version) options.version.value = sync.version
        if (sync.recovered && (options.canSave?.() ?? true)) void sync.flush()
      })
    },
    { immediate: true, flush: 'sync' },
  )
  function capture() {
    if (options.canSave && !options.canSave()) return false
    if (sync.applying || (!initialized && options.version)) return false
    const previous = sync.data
    let next = data.value
    if (
      !Object.hasOwn(previous, 'var') &&
      next.var &&
      !Object.keys(next.var).length
    ) {
      next = { ...next }
      delete next.var
    }
    const patches = documentDiff(previous, next),
      events = options.takeEvents?.() || []
    const changed = sync.edit(next, { events })
    return (
      changed &&
      (patches.some((patch) =>
        patch.path.some(
          (part) => typeof part === 'string' && urgentFields.has(part),
        ),
      ) ||
        events.some((event) =>
          ['health', 'status', 'rest'].includes(event.type),
        ))
    )
  }
  function scheduleSave() {
    clearTimeout(timer)
    const urgent = capture()
    if (!sync.pending) return
    if (urgent) void flushSave()
    else timer = setTimeout(flushSave, SAVE_DELAY_MS)
  }
  async function flushSave() {
    clearTimeout(timer)
    capture()
    const wait = sync.whenIdle()
    void sync.flush()
    try {
      await wait
      return true
    } catch {
      return false
    }
  }
  function retrySave() {
    saveError.value = ''
    void sync.retry()
  }
  function dismissSaveError() {
    saveError.value = ''
  }
  async function reloadSave() {
    try {
      await sync.reload()
      return true
    } catch (error) {
      saveError.value = error.message
      return false
    }
  }
  function keydown(event) {
    if (
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      event.target?.closest?.('input,textarea,[contenteditable="true"]')
    )
      return
    const key = event.key.toLowerCase()
    if (
      key === 'z' && !event.shiftKey
        ? sync.undo()
        : (key === 'y' || (key === 'z' && event.shiftKey)) && sync.redo()
    )
      event.preventDefault()
  }
  globalThis.window?.addEventListener('keydown', keydown)
  onBeforeUnmount(() => {
    clearTimeout(timer)
    stopVersion()
    stopReady()
    // Let the current packet and later queued edits finish after closing.
    // Stopping immediately would leave the latter unsent until the next open.
    capture()
    void finishDocumentSync(sync)
    globalThis.window?.removeEventListener('keydown', keydown)
  })
  return {
    historyState,
    saveStatus,
    saveError,
    pendingSecondsLeft,
    scheduleSave,
    retrySave,
    dismissSaveError,
    reloadSave,
    flushSave,
    sync,
  }
}
