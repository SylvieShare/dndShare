package ru.dndshare.client.maps.rendering

import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import kotlin.math.floor
import ru.dndshare.client.maps.*

/** Subscribe to crops of the main view; no second engine, camera or scene is rendered. */
internal class MapLightFrames(
    private val captures: MapFrameCapture,
    private val changed: () -> Unit,
) : AutoCloseable {
    private class Observer(
        val id: String,
        val width: Int,
        val height: Int,
        val changed: (MapLightFrame) -> Unit,
    ) {
        @Volatile var closed = false
        @Volatile var pending = false
        var key: Pair<Long, Long>? = null
        var capturedAt = Double.NEGATIVE_INFINITY
        @Volatile var state = ""
    }

    private val main = Handler(Looper.getMainLooper())
    private val render = Handler(requireNotNull(Looper.myLooper()))
    private val observers = mutableMapOf<Long, Observer>()
    var nextDelay: Long? = null
        private set

    fun observe(
        token: Long,
        id: String,
        width: Int,
        height: Int,
        changed: (MapLightFrame) -> Unit,
    ) {
        remove(token)
        observers[token] = Observer(id, width, height, changed)
    }

    fun remove(token: Long) {
        observers.remove(token)?.closed = true
    }

    fun prepare(
        context: MapContext?,
        camera: MapCamera,
        width: Int,
        height: Int,
        density: Double,
        revision: Long,
        seconds: Double,
        moving: Boolean,
        anchors: MapVisualAnchors,
    ) {
        nextDelay = null
        val key = revision to if (moving) floor(seconds * 12).toLong() else 0L
        for (observer in observers.values) {
            if (observer.pending || observer.key == key) continue
            val light = context?.document?.rows("lights")?.find { it.string("id") == observer.id }
            val pose = light?.let { anchors.light(mapLightPose(it, context)) }
            val region = pose?.let {
                mapLightFrameRegion(
                    camera,
                    MapPose(it.point.x, it.point.y, it.worldHeight),
                    width,
                    height,
                    observer.width,
                    observer.height,
                    density,
                )
            }
            if (region == null) {
                observer.key = key
                state(observer, if (pose == null) "waiting" else "outside")
                continue
            }
            val remaining = 1.0 / 12 - (seconds - observer.capturedAt)
            if (remaining > 0) {
                val delay = kotlin.math.ceil(remaining * 1000).toLong().coerceAtLeast(1)
                nextDelay = minOf(nextDelay ?: delay, delay)
                continue
            }
            observer.key = key
            observer.capturedAt = seconds
            observer.pending = true
            captures.request(region) { result ->
                // Capture callbacks are delivered on main; render state stays on its owner thread.
                if (observer.closed) result.getOrNull()?.recycle()
                else {
                    observer.state = if (result.isSuccess) "live" else "unavailable"
                    observer.changed(MapLightFrame(observer.state, result.getOrNull()))
                }
                // The single in-flight capture flag is published back to the render owner.
                render.post {
                    observer.pending = false
                    if (!observer.closed) changed()
                }
            }
        }
    }

    private fun state(observer: Observer, value: String) {
        if (observer.state == value) return
        observer.state = value
        main.post { if (!observer.closed) observer.changed(MapLightFrame(value)) }
    }

    override fun close() {
        observers.keys.toList().forEach(::remove)
    }
}

data class MapLightFrame(val state: String, val image: Bitmap? = null)
