package ru.dndshare.client.maps.rendering

import kotlin.math.*

data class MapFrameTiming(val at: Long, val cpu: Map<String, Float>?, val gpuMs: Float?) {
    val cpuMs
        get() = cpu?.values?.sum()
}

data class MapRenderTelemetry(
    val frames: Long = 0,
    val instances: Int = 0,
    val models: Int = 0,
    val fileBytes: Long = 0,
    val time: Long = 0,
    val history: List<MapFrameTiming> = emptyList(),
    val lights: Int = 0,
    val enabled: Boolean = false,
    val fps: Float = 0f,
    val idle: Boolean = true,
    val cpu: Map<String, Float> = emptyMap(),
    val gpuMs: Float? = null,
    val updateMs: Float? = null,
)

/** Same 60 half-second bins as performanceHistory.js; CPU/GPU results have separate timestamps. */
internal class MapPerformanceHistory {
    private class Bin {
        var frames = 0
        val cpu = mutableMapOf<String, Double>()
        var gpu = 0.0
        var gpuCount = 0

        fun timing(at: Long) =
            MapFrameTiming(
                at,
                if (frames > 0) cpu.mapValues { (it.value / frames).toFloat() } else null,
                if (gpuCount > 0) (gpu / gpuCount).toFloat() else null,
            )
    }

    private val bins = sortedMapOf<Long, Bin>()
    private val frames = ArrayDeque<Long>()
    private var started = 0L
    private var last = 0L
    private var lastCpu = emptyMap<String, Float>()
    private var lastGpu: Float? = null
    private var updateMs: Float? = null

    fun reset(at: Long) {
        bins.clear()
        frames.clear()
        started = at
        last = 0
        lastCpu = emptyMap()
        lastGpu = null
        updateMs = null
    }

    private fun bin(at: Long) = bins.getOrPut(at / 500 * 500) { Bin() }

    fun frame(at: Long, cpu: Map<String, Float>) {
        val bin = bin(at)
        bin.frames++
        for ((key, value) in cpu) bin.cpu[key] = (bin.cpu[key] ?: 0.0) + value
        last = at
        frames += at
        prune(at)
    }

    fun gpu(at: Long, ms: Float) {
        if (at >= started && ms.isFinite() && ms > 0) {
            val bin = bin(at)
            bin.gpu += ms
            bin.gpuCount++
        }
    }

    fun update(ms: Float) {
        updateMs = ms
    }

    private fun prune(at: Long) {
        while (frames.firstOrNull()?.let { it <= at - 1000 } == true) frames.removeFirst()
        val first = at / 500 * 500 - 59 * 500
        bins.keys.filter { it < first }.forEach(bins::remove)
    }

    fun snapshot(at: Long): MapRenderTelemetry {
        prune(at)
        val recent =
            bins
                .filterKeys { it >= at - 2000 }
                .values
                .ifEmpty { bins.values.lastOrNull()?.let { listOf(it) }.orEmpty() }
        val count = recent.sumOf { it.frames }
        if (count > 0) {
            val values = mutableMapOf<String, Double>()
            for (bin in recent) for ((key, value) in bin.cpu) values[key] =
                (values[key] ?: 0.0) + value
            lastCpu = values.mapValues { (it.value / count).toFloat() }
        }
        val gpuCount = recent.sumOf { it.gpuCount }
        if (gpuCount > 0) lastGpu = (recent.sumOf { it.gpu } / gpuCount).toFloat()
        else
            bins.values
                .lastOrNull { it.gpuCount > 0 }
                ?.let { lastGpu = (it.gpu / it.gpuCount).toFloat() }
        val first = at / 500 * 500 - 59 * 500
        return MapRenderTelemetry(
            time = last,
            history =
                List(60) { index ->
                    val t = first + index * 500
                    bins[t]?.timing(t) ?: MapFrameTiming(t, null, null)
                },
            enabled = true,
            fps = frames.size * 1000f / max(500L, min(1000L, at - started)),
            idle = last == 0L || at - last > 1000,
            cpu = lastCpu,
            gpuMs = lastGpu,
            updateMs = updateMs,
        )
    }
}
