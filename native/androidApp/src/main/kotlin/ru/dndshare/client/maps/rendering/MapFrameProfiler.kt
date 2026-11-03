package ru.dndshare.client.maps.rendering

/** Marks partition one CPU frame; disabled measurement reads no clock and allocates no parts. */
internal class MapFrameProfiler(private val clock: () -> Long = System::nanoTime) {
    private var previous = 0L
    private var parts: MutableMap<String, Float>? = null

    fun begin(enabled: Boolean) {
        parts = if (enabled) linkedMapOf() else null
        if (enabled) previous = clock()
    }

    fun mark(name: String) {
        val values = parts ?: return
        val now = clock()
        values[name] = (values[name] ?: 0f) + (now - previous).coerceAtLeast(0) / 1_000_000f
        previous = now
    }

    fun finish(): Map<String, Float>? {
        mark("other")
        return parts.also { parts = null }
    }
}
