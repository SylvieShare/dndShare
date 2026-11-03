package ru.dndshare.client

import java.io.IOException
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.test.*
import org.junit.Test
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.network.ApiException

@OptIn(ExperimentalCoroutinesApi::class)
class MapDownloadsTest {
    @Test
    fun failedFilesReleaseTheCallersPreparationBudgetAndRepeatedPickingHonoursBackoff() = runTest {
        val manager = MapDownloads(backgroundScope) { testScheduler.currentTime }
        val budget = Semaphore(3)
        var requests = 0
        val failed =
            (0..2).map { id ->
                async {
                    budget.withPermit {
                        runCatching {
                            manager.read("bad-$id", oneAttempt = true) {
                                requests++
                                throw IOException("Offline")
                            }
                        }
                    }
                }
            }
        val ready = async {
            budget.withPermit { manager.read("ready", oneAttempt = true) { byteArrayOf(7) } }
        }
        runCurrent()
        failed.forEach { assertIs<MapAttemptException>(it.await().exceptionOrNull()) }
        assertContentEquals(byteArrayOf(7), ready.await())
        repeat(5) {
            assertFailsWith<MapAttemptException> {
                manager.read("bad-0", oneAttempt = true) {
                    requests++
                    byteArrayOf()
                }
            }
        }
        assertEquals(3, requests)
        manager.retry()
        assertContentEquals(
            byteArrayOf(8),
            manager.read("bad-0", oneAttempt = true) { byteArrayOf(8) },
        )
    }

    @Test
    fun transientFailureRemainsVisibleDuringTheNextAttemptAndClearsOnlyOnRecovery() = runTest {
        val manager = MapDownloads(backgroundScope) { testScheduler.currentTime }
        val gate = CompletableDeferred<ByteArray>()
        var attempts = 0
        val file = async {
            manager.read("model") {
                if (++attempts == 1) throw IOException("Нет связи") else gate.await()
            }
        }
        runCurrent()
        manager.retry()
        runCurrent()
        assertEquals(MapDownloadPhase.Loading, manager.state.value.getValue("model").phase)
        assertEquals("Нет связи", manager.state.value.getValue("model").error)
        gate.complete(byteArrayOf(1))
        file.await()
        assertNull(manager.state.value.getValue("model").error)
    }

    @Test
    fun invalidatingCatalogueKeepsOldConsumersAliveButTheirCompletionCannotReplaceNewProgress() =
        runTest {
            val manager = MapDownloads(backgroundScope) { testScheduler.currentTime }
            val key = MapDownloadKey<List<String>>("catalogue")
            val old = CompletableDeferred<List<String>>()
            val fresh = CompletableDeferred<List<String>>()
            val first = async { manager.read(key) { old.await() } }
            runCurrent()
            manager.invalidate(key)
            val second = async { manager.read(key) { fresh.await() } }
            runCurrent()
            old.complete(listOf("old"))
            assertEquals(listOf("old"), first.await())
            assertEquals(MapDownloadPhase.Loading, manager.state.value.getValue("catalogue").phase)
            fresh.complete(listOf("fresh"))
            assertEquals(listOf("fresh"), second.await())
            assertEquals(MapDownloadPhase.Ready, manager.state.value.getValue("catalogue").phase)
        }

    @Test
    fun typedCatalogueRequestsShareTheSameQueueAndResultWithoutSerializingData() = runTest {
        val manager = MapDownloads(backgroundScope) { testScheduler.currentTime }
        val key = MapDownloadKey<List<String>>("catalogue")
        val result = CompletableDeferred<List<String>>()
        val first = async { manager.read(key) { result.await() } }
        val second = async { manager.read(key) { error("already requested") } }
        runCurrent()
        first.cancelAndJoin()
        result.complete(listOf("floor", "wall"))
        assertEquals(listOf("floor", "wall"), second.await())
        assertEquals(MapDownloadPhase.Ready, manager.state.value.getValue("catalogue").phase)
    }

    @Test
    fun oneConsumerClosingCannotCancelAnotherConsumersSharedFile() = runTest {
        val manager = MapDownloads(backgroundScope) { testScheduler.currentTime }
        val network = CompletableDeferred<ByteArray>()
        var requests = 0
        val first = async {
            manager.read("model") {
                requests++
                network.await()
            }
        }
        val second = async { manager.read("model") { error("must share the first request") } }
        runCurrent()
        assertEquals(1, requests)
        first.cancelAndJoin()
        assertTrue(second.isActive)
        network.complete(byteArrayOf(1, 2, 3))
        assertContentEquals(byteArrayOf(1, 2, 3), second.await())
        assertEquals(MapDownloadPhase.Ready, manager.state.value.getValue("model").phase)
    }

    @Test
    fun retryingFilesFreeAllSlotsAndCanBeRetriedImmediatelyWithoutWaitingForBackoff() = runTest {
        val manager = MapDownloads(backgroundScope) { testScheduler.currentTime }
        val attempts = mutableMapOf<String, Int>()
        val pending =
            (0..2).map { id ->
                async {
                    manager.read("retry-$id") { progress ->
                        val attempt = (attempts["$id"] ?: 0) + 1
                        attempts["$id"] = attempt
                        progress(12, 100)
                        if (attempt == 1) throw IOException("Offline")
                        byteArrayOf(id.toByte())
                    }
                }
            }
        runCurrent()
        assertEquals(3, manager.state.value.values.count { it.phase == MapDownloadPhase.Retrying })
        val other = async { manager.read("other") { byteArrayOf(9) } }
        runCurrent()
        assertContentEquals(byteArrayOf(9), other.await())
        advanceTimeBy(999)
        assertEquals(listOf(1, 1, 1), attempts.values.toList())
        manager.retry()
        runCurrent()
        pending.forEach { it.await() }
        assertEquals(listOf(2, 2, 2), attempts.values.toList())
        assertTrue(
            manager.state.value.values.all {
                it.phase == MapDownloadPhase.Ready && it.error == null
            }
        )
    }

    @Test
    fun terminalHttpFailureRequiresExplicitRequestAndCancellingLastOwnerRemovesRetryTimer() =
        runTest {
            val manager = MapDownloads(backgroundScope) { testScheduler.currentTime }
            val denied = async {
                runCatching {
                    manager.read("absent") {
                        throw ApiException(404, "NOT_FOUND", "Файл отсутствует")
                    }
                }
            }
            runCurrent()
            assertIs<ApiException>(denied.await().exceptionOrNull())
            assertEquals(404, manager.state.value.getValue("absent").httpStatus)
            val retrying = async { manager.read("offline") { throw IOException("Offline") } }
            runCurrent()
            assertEquals(MapDownloadPhase.Retrying, manager.state.value.getValue("offline").phase)
            retrying.cancelAndJoin()
            advanceTimeBy(60_000)
            runCurrent()
            assertFalse("offline" in manager.state.value)
            assertEquals(MapDownloadPhase.Failed, manager.state.value.getValue("absent").phase)
            manager.invalidate("absent")
            assertContentEquals(byteArrayOf(7), manager.read("absent") { byteArrayOf(7) })
        }

    @Test
    fun policyMatchesWebBackoffAndHttpClassification() {
        assertEquals(
            listOf(1000L, 2000L, 4000L, 8000L, 16000L, 30000L, 30000L),
            (1..7).map(::mapDownloadRetryDelay),
        )
        for (status in listOf(400, 401, 403, 404, 410, 422)) assertFalse(
            mapDownloadRetryable(ApiException(status, "", ""))
        )
        for (status in listOf(408, 429, 500, 502, 503)) assertTrue(
            mapDownloadRetryable(ApiException(status, "", ""))
        )
        assertTrue(mapDownloadRetryable(IOException("broken stream")))
    }
}
