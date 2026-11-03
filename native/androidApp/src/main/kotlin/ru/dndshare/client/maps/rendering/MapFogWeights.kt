package ru.dndshare.client.maps.rendering

import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import ru.dndshare.client.maps.geometry.VolumeFogField

/**
 * Coalesced sparse-mask updates stay off the render looper; uploads retain monotonic completion
 * order.
 */
internal class MapFogWeights(
    scope: CoroutineScope,
    private val current: () -> VolumeFogField?,
    private val upload: (ByteArray) -> Unit,
    private val changed: () -> Unit,
    private val background: CoroutineDispatcher = Dispatchers.Default,
) : AutoCloseable {
    private data class Request(val field: VolumeFogField, val weights: Map<String, Double>)

    private var lastField: VolumeFogField? = null
    private var lastWeights = emptyMap<String, Double>()
    private var pending: Request? = null
    private var busy = false
    private val queue = Channel<Unit>(Channel.CONFLATED)
    val working
        get() = busy || pending != null

    private val worker = scope.launch {
        for (signal in queue) {
            val request = pending ?: continue
            pending = null
            busy = true
            try {
                val bytes =
                    withContext(background) {
                        request.field.weights { request.weights[it] ?: 0.0 }
                        request.field.data.copyOf()
                    }
                if (current() === request.field) {
                    upload(bytes)
                    changed()
                }
            } finally {
                busy = false
            }
        }
    }

    fun seed(field: VolumeFogField, weights: Map<String, Double>) {
        lastField = field
        lastWeights = weights
    }

    fun update(field: VolumeFogField, weights: Map<String, Double>) {
        if (field === lastField && weights == lastWeights) return
        lastField = field
        lastWeights = weights
        pending = Request(field, weights)
        queue.trySend(Unit)
    }

    fun clear() {
        lastField = null
        lastWeights = emptyMap()
        pending = null
    }

    override fun close() {
        clear()
        queue.close()
        worker.cancel()
    }
}
