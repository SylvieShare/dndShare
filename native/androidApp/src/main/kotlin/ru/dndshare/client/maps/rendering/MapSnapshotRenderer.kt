package ru.dndshare.client.maps.rendering

import android.content.Context
import android.graphics.Bitmap
import android.os.Handler
import android.os.HandlerThread
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.*
import kotlinx.coroutines.android.asCoroutineDispatcher
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*

/**
 * A pooled offscreen scene uses the same shaders/loaders as the editor, without an Android window.
 */
internal class MapSnapshotRenderer(context: Context, cache: MapAssetCache) : AutoCloseable {
    private val thread = HandlerThread("DnDShareMapSnapshot").apply { start() }
    private val handler = Handler(thread.looper)
    private val dispatcher = handler.asCoroutineDispatcher("Map snapshots")
    private val initialized = CompletableDeferred<FilamentSceneCore>()
    private val error = AtomicReference<String?>()
    private var core: FilamentSceneCore? = null
    @Volatile private var closed = false

    init {
        handler.post {
            try {
                check(!closed) { "Очередь превью закрыта" }
                check(
                    context
                        .getSystemService(android.app.ActivityManager::class.java)
                        .deviceConfigurationInfo
                        .reqGlEsVersion >= 0x30000
                ) {
                    "Для 3D-превью нужна поддержка OpenGL ES 3.0"
                }
                val created =
                    FilamentSceneCore(context.applicationContext, cache, dispatcher) { _, message ->
                        if (message != null) error.set(message)
                    }
                core = created
                initialized.complete(created)
            } catch (failure: Throwable) {
                initialized.completeExceptionally(failure)
            }
        }
    }

    suspend fun render(
        document: JsonObject,
        models: List<MapModel>,
        width: Int,
        height: Int,
        camera: MapCamera?,
        focus: Set<MapEntityRef>?,
        lod: Boolean,
    ): Bitmap =
        withContext(dispatcher) {
            check(!closed) { "Очередь превью закрыта" }
            val renderer = initialized.await()
            error.set(null)
            renderer.headless(width, height)
            renderer.options(
                MapSceneOptions(
                    animate = false,
                    forceLod = lod,
                    focus = focus,
                    ground = focus == null,
                )
            )
            renderer.update(document, models)
            renderer.camera(
                camera
                    ?: MapCamera()
                        .fit(document.number("width"), document.number("height"), width, height)
            )
            withTimeout(60_000) {
                while (!renderer.settled) {
                    error.get()?.let { throw IllegalStateException(it) }
                    delay(16)
                }
            }
            error.get()?.let { throw IllegalStateException(it) }
            if (camera == null && focus != null) {
                val pose = CompletableDeferred<MapCamera>()
                renderer.fitContents(focus) { pose.complete(it) }
                renderer.camera(pose.await())
            }
            // Finish the submitted readback before another job changes this scene. The caller
            // remains
            // cancellable while waiting for its turn or loading models; only GPU readback is
            // drained.
            withContext(NonCancellable) {
                val bitmap = CompletableDeferred<Bitmap>()
                renderer.snapshot { result ->
                    result.fold(bitmap::complete, bitmap::completeExceptionally)
                }
                withTimeout(10_000) { bitmap.await() }
            }
        }

    override fun close() {
        if (closed) return
        closed = true
        handler.post {
            try {
                core?.close()
                core = null
            } finally {
                thread.quitSafely()
            }
        }
    }
}
