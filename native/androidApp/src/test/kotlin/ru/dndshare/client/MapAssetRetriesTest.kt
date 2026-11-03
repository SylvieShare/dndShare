package ru.dndshare.client

import java.io.IOException
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import org.junit.Test
import ru.dndshare.client.maps.rendering.*

@OptIn(ExperimentalCoroutinesApi::class)
class MapAssetRetriesTest {
    @Test
    fun decodeRetriesInvalidateTheFileOutsideTheWorkQueueAndStopAfterTheOwnerLeaves() = runTest {
        var loads = 0
        val events = mutableListOf<String>()
        val wanted = mutableSetOf("model")
        val retries =
            MapAssetRetries(
                backgroundScope,
                { it in wanted },
                { key, stage -> events += "$stage:$key" },
                { loads++ },
                {},
            )
        retries.starting("model")
        retries.fail("model", IOException("decode"), "decode")
        assertTrue(retries.issues.getValue("model").retrying)
        advanceTimeBy(999)
        runCurrent()
        assertEquals(0, loads)
        advanceTimeBy(1)
        runCurrent()
        assertEquals(1, loads)
        assertEquals(listOf("decode:model"), events)
        retries.starting("model")
        retries.fail("model", IOException("decode"), "decode")
        wanted.clear()
        retries.retain(emptySet())
        advanceTimeBy(60_000)
        runCurrent()
        assertEquals(1, loads)
        assertTrue(retries.issues.isEmpty())
    }

    @Test
    fun emptyGeometryRequiresManualRetryAndSuccessClearsItsFailure() = runTest {
        var loads = 0
        val retries = MapAssetRetries(backgroundScope, { true }, { _, _ -> }, { loads++ }, {})
        retries.starting("model")
        retries.fail("model", MapPermanentLoadException("В файле модели нет геометрии"), "decode")
        advanceTimeBy(60_000)
        runCurrent()
        assertEquals(0, loads)
        assertFalse(retries.issues.getValue("model").retrying)
        retries.retry()
        runCurrent()
        assertEquals(1, loads)
        retries.ready("model")
        assertTrue(retries.issues.isEmpty())
    }
}
