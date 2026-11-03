package ru.dndshare.client.maps.rendering

import kotlin.math.*

internal enum class MapPanDirection(val x: Double, val y: Double) {
    Left(-1.0, 0.0),
    Right(1.0, 0.0),
    Up(0.0, -1.0),
    Down(0.0, 1.0),
}

/** useCameraPan.js: 300 logical px/s, normalized diagonal, acceleration 18 and friction 26. */
internal class MapCameraPanMotion {
    private val held = mutableSetOf<MapPanDirection>()
    private var x = 0.0
    private var y = 0.0
    val moving
        get() = held.isNotEmpty() || hypot(x, y) > .003

    fun down(direction: MapPanDirection) {
        held += direction
    }

    fun up(direction: MapPanDirection) {
        if (direction in held && hypot(x, y) < .001) {
            x = direction.x * .45
            y = direction.y * .45
        }
        held -= direction
    }

    fun stop() {
        held.clear()
        x = 0.0
        y = 0.0
    }

    fun advance(seconds: Double): Pair<Double, Double> {
        val dt = seconds.coerceIn(.001, .04)
        val dx = held.sumOf { it.x }
        val dy = held.sumOf { it.y }
        val length = hypot(dx, dy).coerceAtLeast(1.0)
        val factor = 1 - exp(-dt * if (held.isEmpty()) 26 else 18)
        x += (dx / length - x) * factor
        y += (dy / length - y) * factor
        if (!moving) {
            x = 0.0
            y = 0.0
        }
        return x * dt * 300 to y * dt * 300
    }
}
