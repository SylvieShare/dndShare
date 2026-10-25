// Unmount stops UI capture, but the queue must retain its retry timer until all
// requests finish or a permanent error leaves a recoverable outbox behind.
export async function finishDocumentSync(sync) {
  const idle = sync.whenIdle()
  void sync.flush()
  try {
    await idle
    return true
  } catch {
    return false
  } finally {
    sync.stop()
  }
}
