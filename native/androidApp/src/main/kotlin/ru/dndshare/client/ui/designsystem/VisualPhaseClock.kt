package ru.dndshare.client.ui.designsystem

/** Accumulated visible time; a resumed animation never counts the paused interval. */
internal class VisualPhaseClock {
    private var elapsed = 0L
    private var previous: Long? = null

    fun frame(now: Long): Long {
        previous?.let { elapsed += (now - it).coerceAtLeast(0L) }
        previous = now
        return elapsed
    }

    fun pause() { previous = null }
}
