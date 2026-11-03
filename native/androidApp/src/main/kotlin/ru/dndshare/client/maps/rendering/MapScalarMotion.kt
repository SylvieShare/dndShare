package ru.dndshare.client.maps.rendering

import kotlin.math.*

/** Web scalarMotion's smoothstep and flash curve; only active keys are visited on a frame. */
internal class MapScalarMotion<K : Any> {
    private data class State(
        var value: Double,
        var from: Double,
        var target: Double,
        var elapsed: Double = 0.0,
        var duration: Double = 0.0,
    )

    private val states = mutableMapOf<K, State>()
    private val active = mutableSetOf<K>()
    val changed = mutableSetOf<K>()
    val moving
        get() = active.isNotEmpty()

    fun set(
        key: K,
        target: Double,
        initial: Double = target,
        immediate: Boolean = false,
        duration: Double = 480.0,
    ) {
        val state = states.getOrPut(key) { State(initial, initial, initial) }
        if (immediate) {
            state.value = target
            state.from = target
            state.target = target
            state.elapsed = 0.0
            state.duration = 0.0
            active -= key
        } else if (state.target != target) {
            state.from = state.value
            state.target = target
            state.elapsed = 0.0
            state.duration = duration
            active += key
        }
    }

    fun value(key: K, fallback: Double = 1.0) = states[key]?.value ?: fallback

    fun target(key: K, fallback: Double = 1.0) = states[key]?.target ?: fallback

    fun flash(key: K): Double {
        val state = states[key] ?: return 1.0
        return if (key !in active) 1.0
        else 1 + sin(PI * state.elapsed / state.duration) * 1.25 * abs(state.target - state.from)
    }

    fun advance(delta: Double, immediate: Boolean = false): Boolean {
        changed.clear()
        for (key in active.toList()) {
            val state = states.getValue(key)
            changed += key
            state.elapsed =
                if (immediate) state.duration
                else min(state.duration, state.elapsed + delta.coerceAtLeast(0.0))
            val t = state.elapsed / state.duration
            val eased = t * t * (3 - 2 * t)
            state.value = state.from + (state.target - state.from) * eased
            if (state.elapsed >= state.duration) active -= key
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
