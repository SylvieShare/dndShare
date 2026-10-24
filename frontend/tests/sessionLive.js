import contract from '../../internal/web/testdata/session-live.json' with { type: 'json' }

// Browser fixtures deliver the same envelope as the Go SSE endpoint.
export async function installSessionLive(page) {
  await page.addInitScript(() => {
    const sources = new Set()
    window.EventSource = class extends EventTarget {
      constructor(url) {
        super()
        this.url = url
        sources.add(this)
        window.sessionLiveConnectionCount = sources.size
        setTimeout(() => this.onopen?.(), 0)
      }
      close() { sources.delete(this); window.sessionLiveConnectionCount = sources.size }
    }
    window.emitSessionUpdate = payload => sources.forEach(source =>
      source.dispatchEvent(new MessageEvent('update', { data: JSON.stringify(payload) })))
  })
}

export async function emitSessionLive(page, payload) {
  await page.waitForFunction(() => window.sessionLiveConnectionCount > 0)
  await page.evaluate(update => window.emitSessionUpdate(update), {
    ...payload,
    ...(payload.chronicle ? { chronicle: { ...structuredClone(contract.delta.chronicle), events: [], ...payload.chronicle } } : {}),
  })
}
