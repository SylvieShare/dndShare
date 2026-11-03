package ru.dndshare.client.maps.rendering

import kotlin.math.*

internal data class MapVisualPose(
    val x: Double,
    val y: Double,
    val elevation: Double,
    val rotation: Double,
    val mirrored: Boolean = false,
    val mirrorScale: Double = 1.0,
    val mirroring: Boolean = false,
    val scale: Double = 1.0,
)

/** Same 280 ms pivot rotation / world-X reflection curve as the web rotationMotion. */
internal class MapRotationMotion<K : Any> {
    private data class State(
        var pose: MapVisualPose,
        var target: MapVisualPose,
        var start: MapVisualPose? = null,
        var elapsed: Double = 280.0,
        var flipping: Boolean = false,
        var pivot: Pair<Double, Double>? = null,
    )

    private val states = mutableMapOf<K, State>()
    private val active = mutableSetOf<K>()
    val changed = mutableSetOf<K>()
    val moving
        get() = active.isNotEmpty()

    fun pose(key: K) = states[key]?.pose

    fun set(key: K, pose: MapVisualPose) {
        val next = pose.copy(mirrorScale = 1.0, mirroring = false)
        val state = states[key]
        if (state == null) {
            states[key] = State(next, next)
            return
        }
        val delta = ((next.rotation - state.target.rotation) % 360 + 540) % 360 - 180
        val mirror = state.target.mirrored != next.mirrored
        val flipping = mirror || delta != 0.0 && state.elapsed < 280 && state.flipping
        if (delta != 0.0 || mirror) {
            val target = next.copy(rotation = state.target.rotation + delta)
            val start = state.pose
            val angle = Math.toRadians(target.rotation - start.rotation)
            val c = cos(angle)
            val s = sin(angle)
            val a = 1 - c
            val det = a * a + s * s
            val dx = target.x - (c * start.x - s * start.y)
            val dy = target.y - (s * start.x + c * start.y)
            active += key
            state.start = start
            state.target = target
            state.flipping = flipping
            state.elapsed = 0.0
            state.pivot =
                if (det > 1e-8) ((a * dx - s * dy) / det to (s * dx + a * dy) / det) else null
        } else {
            val dx = next.x - state.target.x
            val dy = next.y - state.target.y
            state.pose =
                state.pose.copy(
                    x = state.pose.x + dx,
                    y = state.pose.y + dy,
                    elevation = next.elevation,
                    scale = next.scale,
                )
            state.start =
                state.start?.let {
                    it.copy(
                        x = it.x + dx,
                        y = it.y + dy,
                        elevation = next.elevation,
                        scale = next.scale,
                    )
                }
            state.pivot = state.pivot?.let { it.first + dx to it.second + dy }
            state.target =
                state.target.copy(
                    x = next.x,
                    y = next.y,
                    elevation = next.elevation,
                    scale = next.scale,
                )
        }
    }

    fun advance(delta: Double, immediate: Boolean = false): Boolean {
        changed.clear()
        for (key in active.toList()) {
            val state = states.getValue(key)
            changed += key
            state.elapsed =
                if (immediate) 280.0 else min(280.0, state.elapsed + delta.coerceAtLeast(0.0))
            val progress = state.elapsed / 280
            val t = if (state.flipping) .5 - .5 * cos(PI * progress) else 1 - (1 - progress).pow(3)
            val start = requireNotNull(state.start)
            val target = state.target
            state.pose =
                if (state.flipping) {
                    val before = t < .5
                    val scale =
                        if (start.mirrored == target.mirrored)
                            start.mirrorScale + (1 - start.mirrorScale) * t
                        else max(.001, if (before) start.mirrorScale * (1 - 2 * t) else 2 * t - 1)
                    state.pose.copy(
                        x = start.x + (target.x - start.x) * t,
                        y = start.y + (target.y - start.y) * t,
                        rotation = if (before) start.rotation else target.rotation,
                        mirrored = if (before) start.mirrored else target.mirrored,
                        mirrorScale = scale,
                        mirroring = true,
                    )
                } else {
                    val angle = Math.toRadians((target.rotation - start.rotation) * t)
                    val point =
                        state.pivot?.let { (px, py) ->
                            val x = start.x - px
                            val y = start.y - py
                            px + x * cos(angle) - y * sin(angle) to
                                py + x * sin(angle) + y * cos(angle)
                        }
                            ?: (start.x + (target.x - start.x) * t to
                                start.y + (target.y - start.y) * t)
                    state.pose.copy(
                        x = point.first,
                        y = point.second,
                        rotation = start.rotation + (target.rotation - start.rotation) * t,
                    )
                }
            if (state.elapsed == 280.0) {
                state.pose = target
                active -= key
            }
        }
        return moving
    }

    fun retain(keys: Set<K>) {
        states.keys.retainAll(keys)
        active.retainAll(keys)
        changed.retainAll(keys)
    }

    fun clear() {
        states.clear()
        active.clear()
        changed.clear()
    }
}
