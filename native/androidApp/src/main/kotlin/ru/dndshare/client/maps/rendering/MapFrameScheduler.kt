package ru.dndshare.client.maps.rendering

import android.view.Choreographer
import kotlin.math.floor

/**
 * Demand frames can promote a delayed effect tick immediately; a paused view cannot keep a timer.
 */
internal class MapFrameScheduler(
    private val frame: (Long) -> Unit,
    private val failure: (Exception) -> Unit,
) : AutoCloseable {
    private val choreographer = Choreographer.getInstance()
    private var scheduled = false
    private var delayed = false
    private var closed = false
    var active = true
        private set

    private val callback = Choreographer.FrameCallback { time ->
        scheduled = false
        delayed = false
        if (!closed && active)
            try {
                frame(time)
            } catch (error: Exception) {
                failure(error)
            }
    }

    fun foreground(value: Boolean) {
        active = value
        if (value) request()
        else {
            choreographer.removeFrameCallback(callback)
            scheduled = false
            delayed = false
        }
    }

    fun request() {
        if (scheduled && delayed && active && !closed) {
            choreographer.removeFrameCallback(callback)
            scheduled = false
            delayed = false
        }
        if (!closed && active && !scheduled) {
            scheduled = true
            choreographer.postFrameCallback(callback)
        }
    }

    fun motion(seconds: Double, fps: Int = 12) {
        if (closed || !active || scheduled) return
        scheduled = true
        delayed = true
        choreographer.postFrameCallbackDelayed(
            callback,
            maxOf(1L, ((floor(seconds * fps) + 1) / fps * 1000 - seconds * 1000 - 8).toLong()),
        )
    }

    fun after(milliseconds: Long) {
        if (closed || !active || scheduled) return
        scheduled = true
        delayed = true
        choreographer.postFrameCallbackDelayed(callback, milliseconds.coerceAtLeast(1))
    }

    override fun close() {
        closed = true
        choreographer.removeFrameCallback(callback)
        scheduled = false
        delayed = false
    }
}
