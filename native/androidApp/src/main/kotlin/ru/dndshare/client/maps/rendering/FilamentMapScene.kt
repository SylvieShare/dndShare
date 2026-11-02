package ru.dndshare.client.maps.rendering

import android.app.ActivityManager
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.view.Surface
import android.view.SurfaceView
import com.google.android.filament.android.UiHelper
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.android.asCoroutineDispatcher
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.MapModel

/** UI facade. Parsing, scene synchronization, uploads and Filament commands stay off Compose. */
class FilamentMapScene(
    surfaceView: SurfaceView,
    cache: MapAssetCache,
    private val status: (Int, String?) -> Unit,
) : AutoCloseable {
    private val thread = HandlerThread("DnDShareMapRenderer").apply { start() }
    private val handler = Handler(thread.looper)
    private val main = Handler(Looper.getMainLooper())
    private val helper = UiHelper(UiHelper.ContextErrorPolicy.DONT_CHECK)
    @Volatile private var core: FilamentSceneCore? = null
    @Volatile private var closed = false
    @Volatile private var pose = MapCamera()
    @Volatile private var ready = emptySet<String>()
    @Volatile private var viewportWidth = 0
    @Volatile private var viewportHeight = 0
    private val dispatcher = handler.asCoroutineDispatcher("Map renderer")
    val width
        get() = viewportWidth

    val height
        get() = viewportHeight

    val readyModelUrls
        get() = ready

    val renderedFrames
        get() = core?.renderedFrames ?: 0L

    val hasMapFrame
        get() = core?.hasMapFrame == true

    val effectStatistics
        get() = core?.effectStatistics ?: MapEffectStatistics()

    init {
        val graphics =
            surfaceView.context
                .getSystemService(ActivityManager::class.java)
                .deviceConfigurationInfo
                .reqGlEsVersion >= 0x30000
        handler.post {
            try {
                check(graphics) { "Для 3D-карт нужна поддержка OpenGL ES 3.0 на устройстве." }
                core =
                    FilamentSceneCore(surfaceView.context.applicationContext, cache, dispatcher) {
                        count,
                        error ->
                        ready = core?.readyModelUrls.orEmpty()
                        main.post { if (!closed) status(count, error) }
                    }
            } catch (error: Exception) {
                main.post { if (!closed) status(0, error.message ?: "Не удалось запустить 3D") }
            }
        }
        helper.renderCallback =
            object : UiHelper.RendererCallback {
                override fun onNativeWindowChanged(surface: Surface) {
                    post { this.surface(surface) }
                }

                override fun onDetachedFromSurface() {
                    // Android can release the native window immediately after this callback.
                    // Drain just its destruction before returning; normal frames never wait on UI.
                    val done = CountDownLatch(1)
                    handler.post {
                        try {
                            core?.detach()
                        } finally {
                            done.countDown()
                        }
                    }
                    check(done.await(5, TimeUnit.SECONDS)) {
                        "Не удалось освободить поверхность карты"
                    }
                }

                override fun onResized(width: Int, height: Int) {
                    viewportWidth = width
                    viewportHeight = height
                    post { resize(width, height) }
                }
            }
        helper.attachTo(surfaceView)
    }

    private fun post(action: FilamentSceneCore.() -> Unit) {
        if (!closed)
            handler.post {
                if (!closed)
                    try {
                        core?.action()
                    } catch (error: Exception) {
                        main.post { if (!closed) status(0, error.message) }
                    }
            }
    }

    fun update(value: JsonObject, catalogue: List<MapModel>) = post { update(value, catalogue) }

    fun camera(value: MapCamera) {
        pose = value
        post { camera(value) }
    }

    fun camera() = pose

    fun options(value: MapSceneOptions) = post { options(value) }

    fun snapshot(result: (Result<android.graphics.Bitmap>) -> Unit) {
        if (closed) {
            main.post { result(Result.failure(IllegalStateException("Редактор закрыт"))) }
            return
        }
        val accepted = handler.post {
            val value = core
            if (closed || value == null)
                main.post { result(Result.failure(IllegalStateException("Редактор закрыт"))) }
            else value.snapshot(result)
        }
        if (!accepted)
            main.post { result(Result.failure(IllegalStateException("Редактор закрыт"))) }
    }

    fun pick(x: Float, y: Float, result: (String?) -> Unit) = post { pick(x, y, result) }

    fun pickSurface(x: Float, y: Float, result: (MapSurfaceHit?) -> Unit) = post {
        pickSurface(x, y, result)
    }

    fun foreground(value: Boolean) = post { foreground(value) }

    fun requestFrame() = post { requestFrame() }

    fun retry() = post { retry() }

    /** Explicit GPU completion is only needed by screenshot/instrumentation callers. */
    fun afterGpuIdle(complete: () -> Unit) = post {
        engine.flushAndWait()
        main.post { if (!closed) complete() }
    }

    override fun close() {
        if (closed) return
        helper.detach()
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
