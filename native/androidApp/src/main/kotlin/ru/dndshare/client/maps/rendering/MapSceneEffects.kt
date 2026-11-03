package ru.dndshare.client.maps.rendering

import android.content.Context
import com.google.android.filament.*
import kotlinx.coroutines.CoroutineScope
import ru.dndshare.client.maps.*

data class MapEffectStatistics(
    val waterModels: Int = 0,
    val decals: Int = 0,
    val flames: Int = 0,
    val fog: Boolean = false,
)

internal class MapSceneEffects(
    context: Context,
    engine: Engine,
    scene: Scene,
    cache: MapAssetCache,
    scope: CoroutineScope,
    changed: () -> Unit,
    private val error: (String?) -> Unit,
) : AutoCloseable {
    private val failures = MapLoadFailures()

    private fun report(key: String): (String?) -> Unit = { message ->
        failures.set(key, message)
        error(failures.message)
    }

    private var fogContext: MapContext? = null
    private val gpu = MapGpuMaterials(engine, context.assets)
    private val water = MapSceneWater(engine, scene, gpu, cache, scope, changed, report("water"))
    private val fire = MapSceneFire(engine, scene, gpu)
    private val decals =
        MapSceneDecals(context, engine, scene, gpu, cache, scope, changed, report("decals"))
    private val fog = MapSceneFog(engine, gpu, scope, changed, report("fog"))
    val working
        get() = water.working || decals.working || fog.working

    val statistics
        get() = MapEffectStatistics(water.modelCount, decals.count, fire.count, fog.ready)

    val failureRecords
        get() = water.failureRecords + decals.failureRecords

    fun shadowMask(value: Set<MapEntityRef>) = water.shadowMask(value)

    val renderMaterials
        get() = water.renderMaterials

    val fogFrame
        get() = fog.frame

    val waterParts
        get() = water.readyParts

    val picks
        get() = water.picks + fire.picks + decals.picks

    fun update(context: MapContext, entries: List<MapSceneEntry>, selected: Set<MapEntityRef>) {
        water.update(entries, selected)
        fire.update(context)
        decals.update(context, entries)
        fogContext = context
    }

    fun appearance(entries: List<MapSceneEntry>, anchors: MapVisualAnchors) {
        water.appearance(entries)
        decals.appearance(entries)
        fire.appearance(anchors)
        fogContext?.let { fog.update(it, anchors.fog) }
    }

    fun surfaceGroups(groups: Map<MapEntityRef, Int>) = water.groups(groups)

    fun transforms(entries: List<MapSceneEntry>, anchors: MapVisualAnchors) {
        if (entries.isEmpty()) return
        water.transforms(entries)
        decals.transforms(entries)
        fire.transforms(anchors)
    }

    fun advance(seconds: Double, motion: Boolean, viewport: MapEffectViewport): Boolean {
        val a = water.advance(seconds, motion, viewport)
        val b = fire.advance(seconds, motion, viewport)
        val c = fog.advance(seconds, motion)
        return a || b || c || fog.visible(viewport) && motion
    }

    fun prepare(view: View, camera: Camera, seconds: Double, motion: Boolean) =
        fog.prepare(view, camera, seconds, motion)

    fun render(renderer: Renderer, view: View, worldRender: (Renderer, View) -> Unit) =
        fog.render(renderer, view, worldRender)

    fun retry() {
        water.retry()
        decals.retry()
        fog.retry()
    }

    override fun close() {
        water.close()
        fire.close()
        decals.close()
        fog.close()
        gpu.close()
    }
}
