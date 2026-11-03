package ru.dndshare.client

import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.maps.rendering.*

class MapPerformanceHistoryTest {
    @Test
    fun halfSecondBinsAverageCpuStagesAndPlaceDelayedGpuInItsOwnFrameInterval() {
        val history = MapPerformanceHistory()
        history.reset(1000)
        history.frame(1100, mapOf("models" to 2f, "draw" to 4f))
        history.frame(1200, mapOf("models" to 4f, "draw" to 6f))
        history.frame(1600, mapOf("draw" to 10f))
        history.gpu(1100, 3f)
        history.gpu(1200, 5f)
        history.gpu(900, 99f)
        val sample = history.snapshot(1700)
        assertEquals(60, sample.history.size)
        val first = sample.history.single { it.at == 1000L }
        assertEquals(mapOf("models" to 3f, "draw" to 5f), first.cpu)
        assertEquals(8f, first.cpuMs)
        assertEquals(4f, first.gpuMs)
        val next = sample.history.single { it.at == 1500L }
        assertEquals(10f, next.cpuMs)
        assertNull(next.gpuMs)
        assertEquals(4f, sample.gpuMs)
        assertFalse(sample.idle)
    }

    @Test
    fun idleHistoryHasGapsZeroFpsAndBoundedOldBinsWhileKeepingLastMeasurements() {
        val history = MapPerformanceHistory()
        history.reset(1000)
        history.frame(1100, mapOf("draw" to 7f))
        history.gpu(1100, 9f)
        val initial = history.snapshot(1200)
        assertTrue(initial.fps > 0)
        val idle = history.snapshot(3000)
        assertEquals(0f, idle.fps)
        assertTrue(idle.idle)
        assertEquals(7f, idle.cpu.values.sum())
        assertNull(idle.history.last().cpu)
        val expired = history.snapshot(40000)
        assertEquals(60, expired.history.size)
        assertTrue(expired.history.all { it.cpu == null && it.gpuMs == null })
        assertEquals(9f, expired.gpuMs)
        history.reset(50000)
        assertTrue(history.snapshot(50000).cpu.isEmpty())
    }

    @Test
    fun cpuStagesPartitionElapsedTimeAndDisabledProfilerDoesNotReadItsClock() {
        var now = 0L
        var reads = 0
        val profiler = MapFrameProfiler {
            reads++
            now
        }
        profiler.begin(false)
        profiler.mark("draw")
        assertNull(profiler.finish())
        assertEquals(0, reads)
        profiler.begin(true)
        now = 2_000_000
        profiler.mark("models")
        now = 5_000_000
        profiler.mark("draw")
        now = 6_000_000
        val result = assertNotNull(profiler.finish())
        assertEquals(mapOf("models" to 2f, "draw" to 3f, "other" to 1f), result)
        assertEquals(6f, result.values.sum())
    }
}
