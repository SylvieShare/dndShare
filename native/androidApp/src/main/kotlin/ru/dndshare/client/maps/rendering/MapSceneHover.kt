package ru.dndshare.client.maps.rendering

import ru.dndshare.client.maps.MapEntityRef

/** At most one asynchronous pick; newer pointer positions replace queued work. */
internal class MapSceneHover(
    private val pick: (Float, Float, (MapEntityRef?) -> Unit) -> Unit,
    private val changed: () -> Unit,
    private val requestFrame: () -> Unit,
) : AutoCloseable {
    private var point: Pair<Float, Float>? = null
    private var dirty = false
    private var waiting = false
    private var serial = 0L
    private var closed = false
    var target: MapEntityRef? = null
        private set

    fun pointer(x: Float?, y: Float?) {
        serial++
        point = if (x != null && y != null) x to y else null
        dirty = point != null
        if (point == null && target != null) {
            target = null
            changed()
        }
        requestFrame()
    }

    fun advance() {
        val next = point ?: return
        if (!dirty || waiting || closed) return
        val version = serial
        dirty = false
        waiting = true
        pick(next.first, next.second) { hit ->
            waiting = false
            if (!closed && version == serial && target != hit) {
                target = hit
                changed()
            }
            if (!closed && dirty) requestFrame()
        }
    }

    override fun close() {
        closed = true
        point = null
        target = null
    }
}
