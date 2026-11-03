package ru.dndshare.client

import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import org.junit.Test
import ru.dndshare.client.maps.rendering.MapPriorityGate

@OptIn(ExperimentalCoroutinesApi::class)
class MapPriorityGateTest {
    @Test
    fun aNewSelectionCanOvertakeQueuedWorkWithoutChangingEqualPriorityOrder() = runTest {
        val priority = mutableMapOf<String, Int>()
        val gate = MapPriorityGate(1) { priority[it] ?: 0 }
        val release = CompletableDeferred<Unit>()
        val events = mutableListOf<String>()
        val first = async { gate.withPermit("busy") { release.await() } }
        runCurrent()
        val pending =
            listOf("normal", "selected", "other").map { url ->
                async { gate.withPermit(url) { events += url } }
            }
        runCurrent()
        priority["selected"] = 100
        release.complete(Unit)
        first.await()
        pending.awaitAll()
        assertEquals(listOf("selected", "normal", "other"), events)
    }

    @Test
    fun cancellingQueuedAndRunningWorkCannotLeakCapacity() = runTest {
        val gate = MapPriorityGate(1) { 0 }
        val hold = CompletableDeferred<Unit>()
        val first = async { gate.withPermit("busy") { hold.await() } }
        runCurrent()
        val removed = async { gate.withPermit("removed") { error("must be cancelled") } }
        runCurrent()
        removed.cancelAndJoin()
        val next = async { gate.withPermit("next") { 7 } }
        runCurrent()
        first.cancelAndJoin()
        assertEquals(7, next.await())
        assertEquals(8, gate.withPermit("last") { 8 })
    }
}
