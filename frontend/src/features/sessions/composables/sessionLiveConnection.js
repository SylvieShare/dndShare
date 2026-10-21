import { applyDocumentPatches, copyDocument } from '@/shared/lib/documentPatch'

const connections = new Map()

// One stream per session in a window, including panels and character modals.
export function subscribeSessionLive(uuid, subscriber) {
  let connection = connections.get(uuid)
  if (!connection) {
    connection = createConnection(uuid)
    connections.set(uuid, connection)
  }
  connection.add(subscriber)
  return () => {
    connection.remove(subscriber)
    if (!connection.size) {
      connection.stop()
      connections.delete(uuid)
    }
  }
}
function createConnection(uuid) {
  const subscribers = new Set()
  let source,
    timer,
    retry = 2000,
    delivery = Promise.resolve(),
    roster,
    sequence = 0,
    stopped = false
  function status(value) {
    for (const subscriber of subscribers) subscriber.status(value)
  }
  function open() {
    if (stopped || source || typeof EventSource === 'undefined') return
    const cursors = [...subscribers]
      .map((entry) => entry.cursor?.())
      .filter((value) => value != null)
    const after = cursors.length ? Math.min(...cursors) : 0
    const url = `/api/sessions/${encodeURIComponent(uuid)}/live${after ? `?after=${after}` : ''}`
    const current = (source = new EventSource(url))
    status('connecting')
    current.onopen = () => {
      if (source === current) {
        retry = 2000
        status('connected')
      }
    }
    current.addEventListener('update', (event) => {
      delivery = delivery
        .then(async () => {
          if (stopped || source !== current) return
          const update = JSON.parse(event.data)
          if (update.roster) {
            const change = update.roster
            if (change.data !== undefined) roster = copyDocument(change.data)
            else {
              if (!roster || change.fromSequence !== sequence)
                throw new Error('Session stream sequence gap')
              roster = applyDocumentPatches(roster, change.patches)
            }
            sequence = change.sequence
          }
          await Promise.all(
            [...subscribers].map((entry) => entry.update(update)),
          )
        })
        .catch(() => reconnect(current))
    })
    current.onerror = () => reconnect(current)
  }
  function reconnect(current) {
    if (source !== current || stopped) return
    current.close()
    source = null
    status('error')
    clearTimeout(timer)
    timer = setTimeout(async () => {
      if (stopped) return
      if (globalThis.document?.visibilityState !== 'hidden')
        await Promise.allSettled(
          [...subscribers].map((entry) => entry.catchUp()),
        )
      retry = Math.min(30000, Math.round(retry * 1.8))
      roster = undefined
      sequence = 0
      open()
    }, retry)
  }
  return {
    get size() {
      return subscribers.size
    },
    add(subscriber) {
      subscribers.add(subscriber)
      if (source) {
        subscriber.status(source.readyState === 1 ? 'connected' : 'connecting')
        if (roster)
          void Promise.resolve(
            subscriber.update({
              roster: { data: copyDocument(roster), sequence, patches: [] },
            }),
          ).catch(() => subscriber.catchUp())
      } else open()
    },
    remove(subscriber) {
      subscribers.delete(subscriber)
    },
    stop() {
      stopped = true
      clearTimeout(timer)
      source?.close()
      source = null
    },
  }
}
