package ru.dndshare.client.maps.rendering

import android.content.Context
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.*

/** App-wide preference, independent of map/account documents. All storage access stays on IO. */
class MapRenderSettings private constructor(context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val writes = Channel<Boolean>(Channel.CONFLATED)
    private val state = MutableStateFlow(false)
    val forceLod = state.asStateFlow()
    private val restored = CompletableDeferred<Unit>()
    private val guard = Any()
    private var edited = false

    init {
        val app = context.applicationContext
        scope.launch {
            val preferences = runCatching {
                app.getSharedPreferences("native-map-render", Context.MODE_PRIVATE)
            }.getOrNull()
            val value = runCatching {
                preferences?.getBoolean("force-lod", false) ?: false
            }.getOrDefault(false)
            synchronized(guard) { if (!edited) state.value = value }
            restored.complete(Unit)
            for (next in writes) runCatching {
                preferences?.edit()?.putBoolean("force-lod", next)?.commit()
            }
        }
    }

    suspend fun ready() {
        restored.await()
    }

    fun setForceLod(value: Boolean) {
        synchronized(guard) {
            edited = true
            state.value = value
            writes.trySend(value)
        }
    }

    companion object {
        @Volatile private var instance: MapRenderSettings? = null

        @Synchronized
        fun get(context: Context): MapRenderSettings =
            instance ?: MapRenderSettings(context).also { instance = it }
    }
}
