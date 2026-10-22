import { takeDocumentBatch } from './documentBatch'
import { createDocumentOutbox } from './documentOutbox'
import { createDocumentUndo } from './documentUndo'
import {
  copyDocument,
  sameDocument,
  documentDiff,
  applyDocumentPatches,
  rebaseDocumentChanges,
} from './documentPatch'

// One instance owns one document. A request remains immutable until acknowledged;
// edits made while it is in flight stay in a separate ordered queue.
export function createDocumentSync(options) {
  const canonicalize = options.canonicalize || (data => data)
  let base = canonicalize(copyDocument(options.data)),
    desired = copyDocument(base),
    version = options.version || 0
  let queue = [],
    flight = null,
    draining = null,
    timer,
    stopped = false,
    blocked = null,
    applying = false
  let retryDelay = 500
  const subscribers = new Set()
  let lastStatus = {
    status: 'idle',
    version,
    pending: 0,
    canUndo: false,
    canRedo: false,
    error: null,
  }
  let deferredRemote = []
  const outbox = createDocumentOutbox(options.storageKey)
  const undoHistory = createDocumentUndo({
    data: () => desired,
    restore(next, action) {
      edit(next, { action }, { record: false })
      render(next)
      void flush()
    },
    onError: (error) => publish('conflict', error),
  })
  function publish(status, error = null) {
    const state = {
      status,
      error,
      version,
      pending: queue.length + (flight?.groups.length || 0),
      canUndo: undoHistory.canUndo,
      canRedo: undoHistory.canRedo,
    }
    lastStatus = state
    for (const listener of subscribers) listener(state)
    options.onStatus?.(state)
  }
  function persist() {
    outbox.write(
      queue.length || flight ? { base, version, queue, flight } : null,
    )
  }
  function render(next) {
    desired = canonicalize(next)
    applying = true
    try {
      options.onData?.(copyDocument(desired))
    } finally {
      applying = false
    }
  }
  function edit(next, metadata = {}, { record = true } = {}) {
    if (applying || stopped) return false
    next = canonicalize(copyDocument(next))
    const patches = documentDiff(desired, next)
    if (!patches.length && !metadata.events?.length) return false
    queue.push({ patches, metadata: copyDocument(metadata) })
    if (record && patches.length) undoHistory.record(desired, next)
    desired = copyDocument(next)
    persist()
    publish(blocked ? 'conflict' : 'pending', blocked)
    return true
  }
  const undo = () => !stopped && undoHistory.undo()
  const redo = () => !stopped && undoHistory.redo()
  function rebase(next, nextVersion, { acknowledged = false } = {}) {
    const groups = [...(!acknowledged && flight ? flight.groups : []), ...queue]
    let old =
        acknowledged && flight
          ? applyDocumentPatches(copyDocument(base), flight.packet.patches)
          : copyDocument(base),
      current = copyDocument(next)
    const retained = []
    for (const group of groups) {
      const result = rebaseDocumentChanges(old, current, group.patches, options.canonicalize)
      old = applyDocumentPatches(old, group.patches)
      current = result.data
      if (result.patches.length || group.metadata.events?.length)
        retained.push({ ...group, patches: result.patches })
    }
    base = canonicalize(copyDocument(next))
    version = nextVersion
    queue = retained
    flight = null
    render(current)
    persist()
  }
  async function catchUp(rejected = false) {
    const response = await options.load(version)
    if (!Number.isInteger(response.version) || response.version < 0)
      throw Object.assign(new Error('Некорректная версия документа'), {
        status: 502,
      })
    if (!rejected && (draining || flight)) {
      deferRemote(response)
      return
    }
    if (response.version < version) return
    const next =
      response.data !== undefined
        ? response.data
        : applyDocumentPatches(copyDocument(base), response.patches || [])
    rebase(next, response.version)
    options.onRemote?.(response)
    publish(queue.length ? 'pending' : 'idle')
  }
  async function drain() {
    clearTimeout(timer)
    while (!stopped && !blocked && (flight || queue.length)) {
      if (!flight) {
        flight = takeDocumentBatch(queue, version)
        persist()
      }
      publish('saving')
      const request = flight
      try {
        const response =
          request.receipt || (await options.send(copyDocument(flight.packet)))
        if (flight !== request) return false
        if (
          !Number.isInteger(response.version) ||
          response.version <= request.packet.baseVersion
        )
          throw Object.assign(
            new Error('Некорректное подтверждение сохранения'),
            { status: 502 },
          )
        request.receipt = response
        persist()
        const groups = flight.groups
        const next =
          response.data !== undefined
            ? response.data
            : applyDocumentPatches(
                copyDocument(base),
                response.patches || flight.packet.patches,
              )
        rebase(next, response.version, { acknowledged: true })
        retryDelay = 500
        options.onAck?.(
          response,
          groups.map((group) => group.metadata),
        )
        while (deferredRemote.length) {
          const remote = deferredRemote.shift()
          if (remote.version <= version) continue
          if (remote.data === undefined && remote.fromVersion !== version) {
            await catchUp(true)
            deferredRemote = []
            break
          }
          const next =
            remote.data !== undefined
              ? remote.data
              : applyDocumentPatches(copyDocument(base), remote.patches || [])
          rebase(next, remote.version)
          options.onRemote?.(remote)
        }
      } catch (error) {
        if (flight !== request) {
          if (flight === null && error.status === 409) {
            blocked = error
            persist()
            publish('conflict', error)
          }
          return false
        }
        if (request.receipt) {
          blocked = error
          persist()
          publish('conflict', error)
          return false
        }
        if (error.status === 409 && options.load) {
          try {
            await catchUp(true)
            continue
          } catch (failure) {
            if (failure.status === 409) {
              blocked = failure
              publish('conflict', failure)
              return false
            }
            error = failure
          }
        }
        if (error.status && error.status < 500 && error.status !== 429) {
          blocked = error
          publish('error', error)
          return false
        }
        publish('retrying', error)
        timer = setTimeout(
          () => {
            draining = null
            void flush()
          },
          retryDelay + Math.round(Math.random() * retryDelay * 0.2),
        )
        retryDelay = Math.min(30000, retryDelay * 2)
        return false
      }
    }
    if (!stopped) publish('idle')
    return !blocked && !flight && !queue.length
  }
  function flush() {
    if (draining) return draining
    if (blocked) return Promise.resolve(false)
    draining = drain().finally(() => {
      draining = null
    })
    return draining
  }
  function receive(response) {
    if (!Number.isInteger(response.version) || response.version < 0)
      return false
    if (response.version <= version) return true
    if (draining || flight) {
      deferRemote(response)
      return true
    }
    if (response.fromVersion !== undefined && response.fromVersion !== version)
      return false
    try {
      const next =
        response.data !== undefined
          ? response.data
          : applyDocumentPatches(copyDocument(base), response.patches || [])
      rebase(next, response.version)
      options.onRemote?.(response)
      publish(queue.length ? 'pending' : 'idle')
      return true
    } catch (error) {
      blocked = error
      publish('conflict', error)
      return false
    }
  }
  function deferRemote(response) {
    if (response.data !== undefined)
      deferredRemote = [
        response,
        ...deferredRemote.filter((item) => item.version > response.version),
      ]
    else deferredRemote.push(response)
    if (deferredRemote.length > 128)
      deferredRemote = [
        {
          version: Math.max(...deferredRemote.map((item) => item.version)),
          fromVersion: -1,
        },
      ]
  }
  function reset(data, nextVersion, { preserveOutbox = false } = {}) {
    base = canonicalize(copyDocument(data))
    desired = copyDocument(base)
    version = nextVersion
    queue = []
    flight = null
    blocked = null
    deferredRemote = []
    undoHistory.clear()
    if (!preserveOutbox) persist()
    publish('idle')
  }
  async function reload() {
    const previous = copyDocument(desired)
    const snapshot = await options.load(-1)
    if (!sameDocument(previous, desired))
      throw new Error(
        'Во время загрузки появились новые правки. Повторите загрузку.',
      )
    if (snapshot.data === undefined)
      throw new Error('Сервер не вернул документ')
    reset(snapshot.data, snapshot.version)
    render(snapshot.data)
    options.onRemote?.(snapshot)
  }
  function retry() {
    if (blocked && flight && !flight.receipt) {
      queue = [...flight.groups, ...queue]
      flight = null
    }
    blocked = null
    persist()
    return flush()
  }
  function stop() {
    stopped = true
    clearTimeout(timer)
    persist()
  }
  function whenIdle() {
    if (blocked) return Promise.reject(blocked)
    if (!queue.length && !flight) return Promise.resolve(true)
    return new Promise((resolve, reject) => {
      const listener = (state) => {
        if (state.status === 'idle') {
          subscribers.delete(listener)
          resolve(true)
        } else if (state.status === 'error' || state.status === 'conflict') {
          subscribers.delete(listener)
          reject(state.error)
        }
      }
      subscribers.add(listener)
    })
  }
  function restorePending() {
    try {
      const saved = outbox.read()
      if (!saved || !Array.isArray(saved.queue)) return
      const current = base,
        currentVersion = version
      base = saved.base
      version = saved.version
      queue = saved.queue
      flight = saved.flight
      render(
        applyDocumentPatches(copyDocument(base), [
          ...(flight?.packet.patches || []),
          ...queue.flatMap((group) => group.patches),
        ]),
      )
      // Even if the initial GET is newer, retry the original mutation first:
      // its durable receipt is what proves that semantic events were committed.
      if (flight) {
        if (currentVersion > version)
          deferRemote({ data: current, version: currentVersion })
      } else if (currentVersion !== version || !sameDocument(current, base))
        rebase(current, currentVersion)
      publish('pending')
    } catch (error) {
      blocked = error
      publish('conflict', error)
    }
  }
  if (options.restore !== false) restorePending()
  return {
    edit,
    flush,
    receive,
    retry,
    reset,
    reload,
    stop,
    undo,
    redo,
    whenIdle,
    catchUp,
    restorePending,
    subscribe(listener) {
      subscribers.add(listener)
      listener(lastStatus)
      return () => subscribers.delete(listener)
    },
    get data() {
      return copyDocument(desired)
    },
    get confirmed() {
      return copyDocument(base)
    },
    get version() {
      return version
    },
    get pending() {
      return !!(queue.length || flight)
    },
    get applying() {
      return applying
    },
  }
}
