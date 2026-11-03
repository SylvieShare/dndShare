package ru.dndshare.client.maps.rendering

import android.os.SystemClock
import com.google.android.filament.Renderer

data class MapFrameTiming(val cpuMs: Float, val gpuMs: Float?)

data class MapRenderTelemetry(
    val frames: Long = 0,
    val instances: Int = 0,
    val models: Int = 0,
    val fileBytes: Long = 0,
    val time: Long = 0,
    val history: List<MapFrameTiming> = emptyList(),
)

/** GPU durations come from Filament queries; unavailable samples stay unavailable. */
internal class MapTelemetryCollector {
    private val history = ArrayDeque<MapFrameTiming>()
    private var frameData: Array<Renderer.FrameInfo>? = null

    fun sample(
        renderer: Renderer,
        cpuNs: Long,
        frameCount: Long,
        instances: Int,
        models: Int,
        fileBytes: Long,
    ): MapRenderTelemetry {
        val frames =
            frameData
                ?: Array(renderer.maxFrameHistorySize.coerceAtLeast(1)) { Renderer.FrameInfo() }
                    .also { frameData = it }
        val count = renderer.getFrameInfoHistory(frames)
        val gpu =
            frames
                .take(count)
                .filter { it.gpuFrameDuration > 0 }
                .maxByOrNull { it.frameId }
                ?.gpuFrameDuration
                ?.let { it / 1_000_000f }
        history.addLast(MapFrameTiming(cpuNs / 1_000_000f, gpu))
        while (history.size > 120) history.removeFirst()
        return MapRenderTelemetry(
            frameCount,
            instances,
            models,
            fileBytes,
            SystemClock.uptimeMillis(),
            history.toList(),
        )
    }
}
