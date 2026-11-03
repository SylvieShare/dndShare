package ru.dndshare.client.maps.rendering

import android.os.SystemClock
import com.google.android.filament.Renderer

/** Renderer-thread owner. GPU history is polled only by the visible measurement panel. */
internal class MapTelemetryCollector {
    private val history = MapPerformanceHistory()
    private var frameData: Array<Renderer.FrameInfo>? = null
    private var lastGpuFrame = -1
    var enabled = false
        private set

    fun measure(value: Boolean) {
        if (enabled == value) return
        enabled = value
        if (value) {
            history.reset(SystemClock.uptimeMillis())
            lastGpuFrame = -1
        }
    }

    fun sceneUpdated(ms: Float) {
        if (enabled) history.update(ms)
    }

    fun frame(parts: Map<String, Float>?) {
        if (enabled && parts != null) history.frame(SystemClock.uptimeMillis(), parts)
    }

    fun snapshot(
        renderer: Renderer,
        frameCount: Long,
        instances: Int,
        models: Int,
        fileBytes: Long,
        lights: Int,
    ): MapRenderTelemetry {
        val now = SystemClock.uptimeMillis()
        val measured =
            if (enabled) {
                val frames =
                    frameData
                        ?: Array(renderer.maxFrameHistorySize.coerceAtLeast(1)) {
                                Renderer.FrameInfo()
                            }
                            .also { frameData = it }
                val count = renderer.getFrameInfoHistory(frames)
                val ready =
                    frames
                        .take(count)
                        .filter {
                            it.gpuFrameDuration > 0 &&
                                it.beginFrame > 0 &&
                                it.frameId > lastGpuFrame
                        }
                        .sortedBy { it.frameId }
                for (frame in ready) {
                    history.gpu(frame.beginFrame / 1_000_000, frame.gpuFrameDuration / 1_000_000f)
                    lastGpuFrame = frame.frameId
                }
                history.snapshot(now)
            } else history.snapshot(now).copy(enabled = false)
        return measured.copy(
            frames = frameCount,
            instances = instances,
            models = models,
            fileBytes = fileBytes,
            lights = lights,
        )
    }
}
