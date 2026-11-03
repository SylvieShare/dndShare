package ru.dndshare.client.maps.rendering

import android.animation.ValueAnimator
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.Surface
import com.google.android.filament.*
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
    private val failures = MapLoadFailures()
    private var statusDirty = true
    private var presented = MapSceneLoadState()

    private fun publishStatus() {
        statusDirty = true
        requestFrame()
    }

    private fun report(key: String, message: String?) {
        failures.set(key, message)
        if (message == null) publishStatus()
        else {
            statusDirty = true
            status(assets.pendingCount, failures.message)
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + dispatcher)
    private val world = MapFilamentWorld(context)
    val engine = world.engine
    private val view = world.view
    private val scene = world.scene
    private val renderer = world.renderer
    private val camera = world.camera
    private var swap: SwapChain? = null
    private var closed = false
    private var pose = MapCamera()
    private var options = MapSceneOptions()
    private var density = context.resources.displayMetrics.density.toDouble()
    private var tier: MapModelTier? = null
    private val viewportAssets = MapViewportAssets()
    private val quality = MapSceneQuality()
    private var qualityEntries: List<MapSceneEntry>? = null
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
    private val profiler = MapFrameProfiler()
    @Volatile
    var telemetry = MapRenderTelemetry()
        private set

    private val picker: MapScenePicker
    private val lights: MapSceneLights
    private val shadows: MapSceneShadows
    private val loading: MapSceneLoading
    private val hover: MapSceneHover
    val outlineBuilds
        get() = pipeline.outlineBuilds

    private val frames =
        MapFrameScheduler(::frame) { error ->
            captures.fail(error)
            report("renderer", error.message ?: "Ошибка 3D-поля")
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

    val loadState
        get() =
            presented.copy(
                pendingUrls = assets.pendingUrls + shadows.pendingUrls,
                failures = shadows.failures + effects.failureRecords + assets.failureRecords,
                problem = failures.entries.filterKeys { it != "models" }.values.firstOrNull(),
            )

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
                !shadows.working &&
                hasMapFrame

    fun options(value: MapSceneOptions) {
        revision++
        val reload =
            options.forceLod != value.forceLod ||
                options.automaticLod != value.automaticLod ||
                options.focus != value.focus ||
                options.ground != value.ground
        options = value
        assets.preview(value.preview)
        assets.selection(value.selected + value.preview.refs)
        syncEffects()
        if (reload) document?.let { update(it, models.values.toList()) }
        requestFrame()
    }

    private fun syncEffects() {
        assets.renderContext?.let {
            lights.update(it)
            effects.update(it, assets.drawnEntries, selectedRefs())
            shadows.update(it, assets.drawnEntries)
        }
    }

    private fun selectedRefs() = options.selected + options.preview.refs + assets.previewSelection

    fun fitContents(
        selected: Set<MapEntityRef>?,
        margin: Double = .85,
        result: (MapCamera) -> Unit,
    ) {
        val fitted =
            mapFitScene(
                pose,
                entries.filter { selected == null || it.ref in selected },
                assets.bounds,
                width,
                height,
                margin,
                density,
            )
        Handler(Looper.getMainLooper()).post { result(fitted) }
    }

    fun guides(value: MapModelGuides?) {
        pipeline.guides(value)
        requestFrame()
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
        pipeline = MapScenePipeline(context, engine, scene, camera)
        assets =
            MapSceneAssets(
                engine,
                pipeline.materials,
                scene,
                cache,
                scope,
                ::requestFrame,
                { _, message -> report("models", message) },
                ::assetsChanged,
            )
        lights = MapSceneLights(engine, scene)
        effects =
            MapSceneEffects(context, engine, scene, cache, scope, ::requestFrame) { error ->
                report("effects", error)
            }
        shadows =
            MapSceneShadows(engine, scene, pipeline.materials, cache, scope, ::requestFrame) {
                message ->
                report("shadows", message)
            }
        loading = MapSceneLoading(engine, scene, pipeline.materials)
        picker =
            MapScenePicker(
                pipeline.pickingView,
                camera,
                cache,
                scope,
                { assets.entities + effects.picks + loading.picks },
                { assets.drawnEntries },
                { document },
                ::requestFrame,
            ) { message ->
                report("picking", message)
            }
        hover =
            MapSceneHover(
                picker::hover,
                {
                    revision++
                    requestFrame()
                },
                ::requestFrame,
            )
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

    fun resize(width: Int, height: Int, density: Double = this.density) {
        this.density = density
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
        syncEffects()
        requestFrame()
    }

    fun update(value: JsonObject, catalogue: List<MapModel>) {
        if (closed) return
        val started = if (telemetryCollector.enabled) System.nanoTime() else 0L
        revision++
        motionUpdated(emptyMap())
        document = value
        models.clear()
        models.putAll(catalogue.associateBy { it.uuid })
        tier = desiredTier()
        entries =
            mapSceneEntries(value, models).filter {
                options.focus == null || it.ref in options.focus!!
            }
        pipeline.updateGrid(value, options.ground)
        val visibleDocument = mapSceneScope(value, options.focus)
        val context = MapContext(visibleDocument, catalogue)
        sceneContext = context
        viewportAssets.invalidate()
        reconcileViewport()
        syncEffects()
        publishStatus()
        requestFrame()
        if (started != 0L)
            telemetryCollector.sceneUpdated((System.nanoTime() - started) / 1_000_000f)
    }

    private fun reconcileViewport() {
        val context = sceneContext ?: return
        val details = assets.qualityDetails(entries, context) + options.preview.refs
        val preferred =
            quality.entries(
                context.document,
                entries,
                tier ?: MapModelTier.Render,
                options.forceLod,
                details,
            )
        if (preferred !== qualityEntries) {
            qualityEntries = preferred
            viewportAssets.invalidate()
        }
        val value =
            viewportAssets.update(
                context,
                preferred,
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
        syncEffects()
        publishStatus()
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

    fun hover(x: Float?, y: Float?) = hover.pointer(x, y)

    fun pickSurface(x: Float, y: Float, result: (MapSurfaceHit?) -> Unit) =
        picker.pickSurface(x, y, result)

    fun retry() {
        failures.clear()
        assets.retry()
        effects.retry()
        shadows.retry()
        document?.let { update(it, models.values.toList()) }
    }

    fun foreground(value: Boolean) = frames.foreground(value)

    fun requestFrame() = frames.request()

    fun measurePerformance(value: Boolean) {
        telemetryCollector.measure(value && frames.active)
        if (value) requestFrame()
    }

    fun pollPerformance(): MapRenderTelemetry {
        if (!frames.active) return telemetry.copy(enabled = false, fps = 0f, idle = true)
        telemetry =
            telemetryCollector.snapshot(
                renderer,
                renderedFrames,
                entries.size,
                assets.modelCount,
                assets.fileBytes,
                lights.count,
            )
        return telemetry
    }

    private fun frame(time: Long) {
        if (closed || !frames.active) return
        profiler.begin(telemetryCollector.enabled)
        reconcileViewport()
        assets.advance()
        assets.waterParts(effects.waterParts)
        profiler.mark("models")
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
        shadows.transforms(assets.motionEntries)
        val shadowMask = shadows.mask
        assets.shadowMask(shadowMask)
        effects.shadowMask(shadowMask)
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
        profiler.mark("areas")
        val effectMotion = effects.advance(seconds, motion, MapEffectViewport(pose, width, height))
        profiler.mark("effects")
        assets.renderContext?.let {
            loading.update(
                it,
                assets.requestedEntries,
                assets.readySnapshot.readyRefs,
                selectedRefs(),
                if (options.previewValid) emptySet() else options.preview.refs,
            )
        }
        val loadingMotion = loading.advance(seconds, motion)
        profiler.mark("previews")
        val lightMotion =
            lights.advance(seconds, motion, pose, width, height, options.selectedLight, anchors)
        profiler.mark("lighting")
        val postProcess = effects.prepare(view, camera, seconds, motion)
        profiler.mark("fog")
        hover.advance()
        val selected = selectedRefs()
        pipeline.prepare(
            width,
            height,
            assets.drawnEntries,
            MapOutlineFrame(
                selected,
                setOfNotNull(hover.target).minus(selected),
                revision,
                wasMoving ||
                    poseMotion ||
                    motion &&
                        lightMotion &&
                        (selected.any { it.kind == MapEntityKind.Light } ||
                            hover.target?.kind == MapEntityKind.Light),
            ),
            picker.working,
            density,
            effects,
            assets.surfaceGroups,
            assets.renderMaterials + effects.renderMaterials + loading.renderMaterials,
            if (options.previewValid) "#c1adf1" else "#ef6b73",
            { refs ->
                assets.highlight(refs)
                effects.highlight(refs)
                loading.highlight(refs)
            },
        )
        effectStatistics = effects.statistics
        profiler.mark("overlays")
        val chain = swap
        if (width > 0 && height > 0 && chain != null) {
            if (!renderer.beginFrame(chain, time)) {
                requestFrame()
                return
            }
            try {
                pipeline.render(renderer, view, picker.working, postProcess, effects, profiler)
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
            profiler.mark("previews")
            if (presented !== assets.readySnapshot) {
                presented = assets.readySnapshot
                statusDirty = true
            }
            if (!hasMapFrame && document != null) {
                engine.flushAndWait()
                hasMapFrame = true
                publishStatus()
            }
            if (statusDirty) {
                statusDirty = false
                status(assets.pendingCount, failures.message)
            }
            telemetryCollector.frame(profiler.finish())
        }
        if (poseMotion || assets.working || picker.working || captures.working) requestFrame()
        else if (effectMotion || lightMotion || loadingMotion) frames.motion(seconds)
        else lightFrames.nextDelay?.let(frames::after)
    }

    override fun close() {
        if (closed) return
        closed = true
        lightFrames.close()
        captures.close()
        hover.close()
        picker.close()
        scope.cancel()
        frames.close()
        detach()
        loading.close()
        shadows.close()
        effects.close()
        assets.close()
        pipeline.close()
        lights.close()
        world.close()
    }
}
