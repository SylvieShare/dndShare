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
    error: (String?) -> Unit,
) : AutoCloseable {
    private val gpu = MapGpuMaterials(engine, context.assets)
    private val water = MapSceneWater(engine, scene, gpu, cache, scope, changed, error)
    private val fire = MapSceneFire(engine, scene, gpu)
    private val decals = MapSceneDecals(context, engine, scene, gpu, cache, scope, changed, error)
    private val fog = MapSceneFog(engine, gpu, scope, changed, error)
    val working
        get() = water.working || decals.working || fog.working

    val statistics
        get() = MapEffectStatistics(water.modelCount, decals.count, fire.count, fog.ready)

    val picks
        get() = water.picks + fire.picks + decals.picks

    fun update(context: MapContext, entries: List<MapSceneEntry>) {
        water.update(entries)
        fire.update(context)
        decals.update(context, entries)
        fog.update(context)
    }

    fun advance(seconds: Double, motion: Boolean): Boolean {
        val a = water.advance(seconds, motion)
        val b = fire.advance(seconds, motion)
        return a || b || fog.ready && motion
    }

    fun prepare(view: View, camera: Camera, seconds: Double, motion: Boolean) =
        fog.prepare(view, camera, seconds, motion)

    fun render(renderer: Renderer, view: View) = fog.render(renderer, view)

    fun retry() {
        water.retry()
        decals.retry()
    }

    override fun close() {
        water.close()
        fire.close()
        decals.close()
        fog.close()
        gpu.close()
    }
}
