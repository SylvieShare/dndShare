// Group repeated mutations, with a maximum delay and explicit lifecycle flush.
export function createDeferredTask(run, { delay = 300, maxWait = 1000 } = {}) {
  let idleTimer = null, limitTimer = null, pending = false
  function cancel() {
    clearTimeout(idleTimer)
    clearTimeout(limitTimer)
    idleTimer = limitTimer = null
    pending = false
  }
  function flush() {
    if (!pending) return
    cancel()
    return run()
  }
  function schedule() {
    pending = true
    clearTimeout(idleTimer)
    idleTimer = setTimeout(flush, delay)
    if (limitTimer == null) limitTimer = setTimeout(flush, maxWait)
  }
  return { schedule, flush, cancel, get pending() { return pending } }
}
