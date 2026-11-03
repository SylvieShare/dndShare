package ru.dndshare.client.maps.rendering

import android.animation.ValueAnimator
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.Surface
import com.google.android.filament.*
import com.google.android.filament.gltfio.*
import com.google.android.filament.utils.Utils
import kotlinx.coroutines.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*

/** The renderer looper owns every Filament object; IO never runs on this looper. */
internal class FilamentSceneCore(
    context: Context,
    private val cache: MapAssetCache,
    dispatcher: CoroutineDispatcher,
    private val motionUpdated: (Map<String, MapPose>) -> Unit = {},
    private val status: (Int, String?) -> Unit,
) : AutoCloseable {
    private val scope = CoroutineScope(SupervisorJob() + dispatcher)
    val engine: Engine
    private val view: com.google.android.filament.View
    private val scene: Scene
    private val background: Skybox
    private val renderer: Renderer
    private val camera: Camera
    private var swap: SwapChain? = null
    private var closed = false
    private var pose = MapCamera()
    private var options = MapSceneOptions()
    private val density = context.resources.displayMetrics.density.toDouble()
    private var tier: MapModelTier? = null
    private val viewportAssets = MapViewportAssets()
    private var sceneContext: MapContext? = null
    private var document: JsonObject? = null
    private val models = mutableMapOf<String, MapModel>()
    private var entries = emptyList<MapSceneEntry>()
    private val assets: MapSceneAssets
    private val effects: MapSceneEffects
    private val pipeline: MapScenePipeline
    private val captures = MapFrameCapture()
    private val lightFrames = MapLightFrames(captures, ::requestFrame)
    private var revision = 0L
    private val telemetryCollector = MapTelemetryCollector()
    @Volatile
    var telemetry = MapRenderTelemetry()
        private set

    private val picker: MapScenePicker
    private val lights: MapSceneLights
    private val frames =
        MapFrameScheduler(::frame) { error ->
            captures.fail(error)
            status(assets.pendingCount, error.message)
        }
    val width
        get() = view.viewport.width

    val height
        get() = view.viewport.height

    @Volatile
    var renderedFrames = 0L
        private set

    @Volatile
    var hasMapFrame = false
        private set

    @Volatile
    var effectStatistics = MapEffectStatistics()
        private set

    val readyRefs
        get() = assets.drawnEntries.map { it.ref }.toSet()

    val readyModelUrls
        get(): Set<String> {
            val ids = assets.drawnEntries.map { it.model.uuid }.toSet()
            return models.values
                .filter { it.uuid in ids }
                .flatMap { listOf(it.renderUrl, it.lodUrl).filter(String::isNotBlank) }
                .toSet() + assets.drawnEntries.map { it.model.renderUrl }
        }

    private fun activeUrl(model: MapModel) =
        if (tier == MapModelTier.Lod) model.lodUrl.ifBlank { model.renderUrl } else model.renderUrl

    private fun desiredTier() =
        if (options.automaticLod) mapModelTier(pose.pixels / density, tier, options.forceLod)
        else if (options.forceLod) MapModelTier.Lod else MapModelTier.Render

    private fun updateTier() {
        if (desiredTier() != tier) document?.let { update(it, models.values.toList()) }
    }

    val settled
        get() =
            document != null &&
                assets.pendingCount == 0 &&
                !assets.working &&
                !effects.working &&
                hasMapFrame

    fun options(value: MapSceneOptions) {
        revision++
        val reload =
            options.forceLod != value.forceLod ||
                options.automaticLod != value.automaticLod ||
                options.focus != value.focus ||
                options.ground != value.ground
        options = value
        assets.selection(value.selected)
        sceneContext?.let { effects.update(it, assets.drawnEntries, value.selected) }
        if (reload) document?.let { update(it, models.values.toList()) }
        requestFrame()
    }

    fun fitContents(selected: Set<MapEntityRef>?, result: (MapCamera) -> Unit) {
        val fitted =
            mapFitScene(
                pose,
                entries.filter { selected == null || it.ref in selected },
                assets.bounds,
                width,
                height,
            )
        Handler(Looper.getMainLooper()).post { result(fitted) }
    }

    fun snapshot(result: (Result<android.graphics.Bitmap>) -> Unit) {
        if (!frames.active || swap == null || width <= 0 || height <= 0) {
            Handler(Looper.getMainLooper()).post {
                result(Result.failure(IllegalStateException("Карта ещё не готова")))
            }
            return
        }
        captures.request(result = result)
        requestFrame()
    }

    init {
        Utils.init()
        Gltfio.init()
        engine =
            Engine.Builder()
                .backend(Engine.Backend.OPENGL)
                .config(Engine.Config().apply { enableMultipleDirectionalLights = true })
                .build()
        engine.setAutomaticInstancingEnabled(true)
        renderer = engine.createRenderer()
        scene = engine.createScene()
        val backgroundColour = mapLinearColour("#161b23")
        background =
            Skybox.Builder()
                .color(backgroundColour[0], backgroundColour[1], backgroundColour[2], 1f)
                .build(engine)
        background.setLayerMask(255, 1)
        scene.skybox = background
        camera = engine.createCamera(EntityManager.get().create())
        camera.setExposure(1f)
        view =
            engine.createView().apply {
                this.scene = this@FilamentSceneCore.scene
                this.camera = this@FilamentSceneCore.camera
                antiAliasing = com.google.android.filament.View.AntiAliasing.FXAA
                setVisibleLayers(0xff, 1 or 16)
                setDynamicLightingOptions(
                    .01f,
                    2000f,
                ) // Orthographic editor eye is 500 units from the map.
            }
        renderer.clearOptions =
            Renderer.ClearOptions().apply {
                clear = true
                clearColor =
                    doubleArrayOf(
                        backgroundColour[0].toDouble(),
                        backgroundColour[1].toDouble(),
                        backgroundColour[2].toDouble(),
                        1.0,
                    )
            }
        pipeline = MapScenePipeline(context, engine, scene, camera)
        assets =
            MapSceneAssets(
                engine,
                pipeline.materials,
                scene,
                cache,
                scope,
                ::requestFrame,
                status,
                ::assetsChanged,
            )
        lights = MapSceneLights(engine, scene)
        effects =
            MapSceneEffects(context, engine, scene, cache, scope, ::requestFrame) { error ->
                status(assets.pendingCount, error)
            }
        picker =
            MapScenePicker(
                pipeline.pickingView,
                camera,
                cache,
                scope,
                { assets.entities + effects.picks },
                { assets.drawnEntries },
                { document },
                ::requestFrame,
            ) { message ->
                status(assets.pendingCount, message)
            }
    }

    fun headless(width: Int, height: Int) {
        if (swap != null && this.width == width && this.height == height) return
        detach()
        swap = engine.createSwapChain(width, height, SwapChainFlags.CONFIG_READABLE)
        resize(width, height)
    }

    fun surface(surface: Surface) {
        swap?.let(engine::destroySwapChain)
        swap = engine.createSwapChain(surface, SwapChainFlags.CONFIG_READABLE)
        requestFrame()
    }

    fun detach() {
        swap?.let {
            engine.destroySwapChain(it)
            engine.flushAndWait()
        }
        swap = null
    }

    fun resize(width: Int, height: Int) {
        revision++
        view.viewport = Viewport(0, 0, width, height)
        updateCamera()
        requestFrame()
    }

    fun camera(value: MapCamera) {
        revision++
        pose = value
        updateCamera()
        updateTier()
        requestFrame()
    }

    private fun updateCamera() = applyMapCamera(camera, pose, width, height)

    private fun assetsChanged() {
        viewportAssets.invalidate()
        revision++
        sceneContext?.let { effects.update(it, assets.drawnEntries, options.selected) }
        requestFrame()
    }

    fun update(value: JsonObject, catalogue: List<MapModel>) {
        if (closed) return
        revision++
        motionUpdated(emptyMap())
        document = value
        models.clear()
        models.putAll(catalogue.associateBy { it.uuid })
        tier = desiredTier()
        entries =
            mapSceneEntries(value, models)
                .filter { options.focus == null || it.ref in options.focus!! }
                .map {
                    it.copy(model = it.model.copy(renderUrl = activeUrl(it.model)))
                }
        pipeline.updateGrid(value, options.ground)
        val visibleDocument = mapSceneScope(value, options.focus)
        val context = MapContext(visibleDocument, catalogue)
        sceneContext = context
        viewportAssets.invalidate()
        reconcileViewport()
        lights.update(context)
        effects.update(context, assets.drawnEntries, options.selected)
        status(assets.pendingCount, null)
        requestFrame()
    }

    private fun reconcileViewport() {
        val context = sceneContext ?: return
        val value =
            viewportAssets.update(
                context,
                entries,
                assets.bounds,
                pose,
                width,
                height,
                density,
                options.streamAssets,
                options.selectedLight,
                previousVisual = { assets.drawnEntries },
            ) ?: return
        assets.update(value, context)
        effects.update(context, assets.drawnEntries, options.selected)
        status(assets.pendingCount, null)
    }

    fun observeLight(
        token: Long,
        id: String,
        width: Int,
        height: Int,
        changed: (MapLightFrame) -> Unit,
    ) {
        lightFrames.observe(token, id, width, height, changed)
        requestFrame()
    }

    fun removeLightObserver(token: Long) = lightFrames.remove(token)

    fun pick(x: Float, y: Float, result: (MapEntityRef?) -> Unit) = picker.pick(x, y, result)

    fun pickSurface(x: Float, y: Float, result: (MapSurfaceHit?) -> Unit) =
        picker.pickSurface(x, y, result)

    fun retry() {
        assets.retry()
        effects.retry()
        document?.let { update(it, models.values.toList()) }
    }

    fun foreground(value: Boolean) = frames.foreground(value)

    fun requestFrame() = frames.request()

    private fun frame(time: Long) {
        val cpuStart = System.nanoTime()
        if (closed || !frames.active) return
        reconcileViewport()
        assets.advance()
        assets.waterParts(effects.waterParts)
        val seconds = time / 1_000_000_000.0
        val motion = options.animate && ValueAnimator.areAnimatorsEnabled()
        val wasMoving = assets.motionMoving
        val poseMotion = assets.animate(seconds, motion)
        if (wasMoving && !poseMotion || viewportAssets.retainedVisual) {
            viewportAssets.invalidate()
            requestFrame()
        }
        val anchors = assets.visualAnchors
        effects.surfaceGroups(assets.surfaceIds)
        effects.appearance(assets.appearanceEntries, anchors)
        effects.transforms(assets.motionEntries, anchors)
        if (anchors.deltas.isNotEmpty()) {
            val positions =
                sceneContext
                    ?.document
                    ?.rows("lights")
                    .orEmpty()
                    .filter { row ->
                        mapAnchorRef(row["anchor"] as? JsonObject) in anchors.deltas
                    }
                    .map { row ->
                        val light = anchors.light(mapLightPose(row, requireNotNull(sceneContext)))
                        row.string("id") to light.point.copy(elevation = light.worldHeight)
                    }
                    .toMap()
            motionUpdated(positions)
        }
        val effectMotion = effects.advance(seconds, motion)
        val lightMotion =
            lights.advance(seconds, motion, pose, width, height, options.selectedLight, anchors)
        val postProcess = effects.prepare(view, camera, seconds, motion)
        pipeline.prepare(
            width,
            height,
            assets.drawnEntries,
            options.selected.isNotEmpty(),
            picker.working,
            density,
            effects,
            assets.surfaceGroups,
            assets.renderMaterials + effects.renderMaterials,
        )
        effectStatistics = effects.statistics
        val chain = swap
        if (width > 0 && height > 0 && chain != null) {
            if (!renderer.beginFrame(chain, time)) {
                requestFrame()
                return
            }
            try {
                pipeline.render(renderer, view, picker.working, postProcess, effects)
                lightFrames.prepare(
                    sceneContext,
                    pose,
                    width,
                    height,
                    density,
                    revision,
                    seconds,
                    effectMotion || lightMotion || poseMotion,
                    anchors,
                )
                captures.render(renderer, width, height)
            } finally {
                renderer.endFrame()
            }
            renderedFrames++
            telemetry =
                telemetryCollector.sample(
                    renderer,
                    System.nanoTime() - cpuStart,
                    renderedFrames,
                    entries.size,
                    assets.modelCount,
                    assets.fileBytes,
                    lights.count,
                )
            if (!hasMapFrame && document != null) {
                engine.flushAndWait()
                hasMapFrame = true
                status(assets.pendingCount, null)
            }
        }
        if (poseMotion || assets.working || picker.working || captures.working) requestFrame()
        else if (effectMotion || lightMotion) frames.motion(seconds)
        else lightFrames.nextDelay?.let(frames::after)
    }

    override fun close() {
        if (closed) return
        closed = true
        lightFrames.close()
        captures.close()
        picker.close()
        scope.cancel()
        frames.close()
        detach()
        effects.close()
        assets.close()
        pipeline.close()
        lights.close()
        engine.destroyCameraComponent(camera.entity)
        EntityManager.get().destroy(camera.entity)
        engine.destroyView(view)
        scene.skybox = null
        engine.destroySkybox(background)
        engine.destroyScene(scene)
        engine.destroyRenderer(renderer)
        engine.destroy()
    }
}
