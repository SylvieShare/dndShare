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
import kotlinx.coroutines.*
import kotlinx.coroutines.android.asCoroutineDispatcher
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.MapEntityRef
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
    private val resolution = MapSurfaceResolution(surfaceView, helper)
    @Volatile private var core: FilamentSceneCore? = null
    @Volatile private var closed = false
    private val disposal = kotlinx.coroutines.CompletableDeferred<Unit>()
    val termination: kotlinx.coroutines.Deferred<Unit>
        get() = disposal

    @Volatile private var pose = MapCamera()
    private val cameraFlow = MutableStateFlow(pose)
    val cameraState = cameraFlow.asStateFlow()
    private val lightFlow =
        MutableStateFlow<Map<String, ru.dndshare.client.maps.MapPose>>(emptyMap())
    val lightPositions = lightFlow.asStateFlow()
    private val loads = MutableStateFlow(MapSceneLoadState())
    val loadState = loads.asStateFlow()
    val readyRefs
        get() = loads.value.readyRefs

    private val dispatcher = handler.asCoroutineDispatcher("Map renderer")
    private val settings = MapRenderSettings.get(surfaceView.context)
    private val settingsScope = CoroutineScope(SupervisorJob() + dispatcher)
    @Volatile private var requestedOptions = MapSceneOptions()
    val density = surfaceView.resources.displayMetrics.density
    val width
        get() = resolution.width

    val height
        get() = resolution.height

    val renderWidth
        get() = resolution.bufferWidth

    val renderHeight
        get() = resolution.bufferHeight

    val readyModelUrls
        get() = loads.value.readyUrls

    val renderedFrames
        get() = core?.renderedFrames ?: 0L

    val outlineBuilds
        get() = core?.outlineBuilds ?: 0L

    val hasMapFrame
        get() = core?.hasMapFrame == true

    val telemetry
        get() = core?.telemetry ?: MapRenderTelemetry()

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
                    FilamentSceneCore(
                        surfaceView.context.applicationContext,
                        cache,
                        dispatcher,
                        motionUpdated = { if (!closed) lightFlow.value = it },
                    ) { count, error ->
                        loads.value = core?.loadState ?: MapSceneLoadState()
                        main.post { if (!closed) status(count, error) }
                    }
            } catch (error: Exception) {
                loads.value =
                    loads.value.copy(
                        problem = mapLoadMessage(error.message ?: "Не удалось запустить 3D")
                    )
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
                    resolution.buffer(width, height)
                    val scale = resolution.scaleX
                    val effectiveDensity = this@FilamentMapScene.density.toDouble() * scale
                    post {
                        resize(width, height, effectiveDensity)
                        camera(resolution.render(this@FilamentMapScene.pose))
                    }
                }
            }
        helper.attachTo(surfaceView)
        settingsScope.launch {
            settings.ready()
            settings.forceLod.collect { enabled ->
                post {
                    options(requestedOptions.copy(forceLod = requestedOptions.forceLod || enabled))
                }
            }
        }
    }

    private fun post(action: FilamentSceneCore.() -> Unit) {
        if (!closed)
            handler.post {
                if (!closed)
                    try {
                        core?.action()
                    } catch (error: Exception) {
                        loads.value =
                            loads.value.copy(
                                problem =
                                    mapLoadMessage(error.message ?: "Не удалось подготовить сцену")
                            )
                        main.post { if (!closed) status(0, error.message) }
                    }
            }
    }

    fun update(value: JsonObject, catalogue: List<MapModel>) = post { update(value, catalogue) }

    fun camera(value: MapCamera) {
        pose = value
        cameraFlow.value = value
        post { camera(resolution.render(value)) }
    }

    fun fitContents(selected: Set<MapEntityRef>? = null, margin: Double = .85): Unit = post {
        val scale = resolution.scaleX
        val revision = resolution.revision
        fitContents(selected, margin) {
            if (revision == resolution.revision)
                this@FilamentMapScene.camera(it.copy(pixels = it.pixels / scale))
            else this@FilamentMapScene.fitContents(selected, margin)
        }
    }

    internal fun guides(value: ru.dndshare.client.maps.MapModelGuides?) = post { guides(value) }

    fun camera() = pose

    fun options(value: MapSceneOptions) {
        requestedOptions = value
        post { options(value.copy(forceLod = value.forceLod || settings.forceLod.value)) }
    }

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

    fun observeLight(
        id: String,
        logicalWidth: Int,
        logicalHeight: Int,
        changed: (MapLightFrame) -> Unit,
    ): AutoCloseable {
        val token = observerIds.incrementAndGet()
        post { observeLight(token, id, logicalWidth, logicalHeight, changed) }
        return AutoCloseable { post { removeLightObserver(token) } }
    }

    fun pick(x: Float, y: Float, result: (MapEntityRef?) -> Unit) = post {
        pick((x * resolution.scaleX).toFloat(), (y * resolution.scaleY).toFloat(), result)
    }

    fun hover(x: Float?, y: Float?) = post {
        hover(
            x?.let { (it * resolution.scaleX).toFloat() },
            y?.let { (it * resolution.scaleY).toFloat() },
        )
    }

    fun pickSurface(x: Float, y: Float, result: (MapSurfaceHit?) -> Unit) = post {
        pickSurface((x * resolution.scaleX).toFloat(), (y * resolution.scaleY).toFloat(), result)
    }

    fun foreground(value: Boolean) = post { foreground(value) }

    fun requestFrame() = post { requestFrame() }

    fun retry() = post { retry() }

    fun resourcesReady(result: (Boolean) -> Unit) = post {
        val ready = settled
        main.post { if (!closed) result(ready) }
    }

    fun measurePerformance(value: Boolean) = post { measurePerformance(value) }

    fun performance(result: (MapRenderTelemetry) -> Unit) = post {
        val value = pollPerformance()
        main.post { if (!closed) result(value) }
    }

    /** Explicit GPU completion is only needed by screenshot/instrumentation callers. */
    fun afterGpuIdle(complete: () -> Unit) = post {
        engine.flushAndWait()
        main.post { if (!closed) complete() }
    }

    private val observerIds = java.util.concurrent.atomic.AtomicLong()

    override fun close() {
        if (closed) return
        resolution.close()
        settingsScope.cancel()
        helper.detach()
        closed = true
        handler.post {
            try {
                core?.close()
                core = null
                disposal.complete(Unit)
            } catch (failure: Throwable) {
                disposal.completeExceptionally(failure)
                throw failure
            } finally {
                thread.quitSafely()
            }
        }
    }
}
