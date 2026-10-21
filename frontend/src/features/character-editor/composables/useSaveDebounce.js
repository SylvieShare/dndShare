import { ref, watch, onBeforeUnmount } from 'vue'
import { getActivePinia } from 'pinia'
import { useAccountStore } from '@/stores/account'
import { fetchGet, fetchPatch } from '@/shared/api/http'
import { createDocumentSync } from '@/shared/lib/documentSync'
import { documentDiff, applyDocumentPatches } from '@/shared/lib/documentPatch'

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
    initialized = !!options.version?.value
  const sync = createDocumentSync({
    data: options.serverDocument?.value?.data || data.value,
    version: options.version?.value || 0,
    restore: initialized,
    storageKey,
    send: (packet) =>
      fetchPatch(`/char/${encodeURIComponent(uuid)}/data`, packet),
    load: (version) =>
      fetchGet(`/char/${encodeURIComponent(uuid)}/changes?after=${version}`),
    onData: (next) => {
      next = { values: {}, var: {}, ...next }
      const current = data.value
      const result = applyDocumentPatches(current, documentDiff(current, next))
      if (result !== current) data.value = result
    },
    onAck: (response) => {
      if (options.version) options.version.value = response.version
    },
    onRemote: (response) => {
      if (options.version) options.version.value = response.version
      options.onMetadata?.(response.metadata)
    },
    onStatus(state) {
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
        options.version,
        (version) => {
          if (version === sync.version) return
          if (!initialized) {
            sync.reset(
              options.serverDocument?.value?.data || data.value,
              version,
              { preserveOutbox: true },
            )
            initialized = true
            sync.restorePending()
            if (sync.pending) void sync.flush()
          } else
            sync.receive({
              data: options.serverDocument?.value?.data || data.value,
              version,
            })
        },
        { flush: 'sync' },
      )
    : () => {}
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
    capture()
    void sync.flush()
    sync.stop()
    globalThis.window?.removeEventListener('keydown', keydown)
  })
  return {
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
