package ru.dndshare.client.maps.rendering

import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Bounded work with live priorities; cancellation releases either a queued or granted ticket. */
internal class MapPriorityGate(private val limit: Int, private val priority: (String) -> Int) {
    private class Ticket(val url: String, val order: Long) {
        val signal = CompletableDeferred<Unit>()
        var granted = false
    }

    private val lock = Mutex()
    private val queue = mutableListOf<Ticket>()
    private var active = 0
    private var order = 0L

    private fun drain() {
        while (active < limit && queue.isNotEmpty()) {
            val ticket =
                requireNotNull(
                    queue.maxWithOrNull(compareBy<Ticket> { priority(it.url) }.thenBy { -it.order })
                )
            queue.remove(ticket)
            ticket.granted = true
            active++
            ticket.signal.complete(Unit)
        }
    }

    suspend fun <T> withPermit(url: String, work: suspend () -> T): T {
        val ticket = lock.withLock {
            Ticket(url, order++).also {
                queue += it
                drain()
            }
        }
        try {
            ticket.signal.await()
            return work()
        } finally {
            withContext(NonCancellable) {
                lock.withLock {
                    queue.remove(ticket)
                    if (ticket.granted) active--
                    drain()
                }
            }
        }
    }
}
