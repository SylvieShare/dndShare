package ru.dndshare.client.maps.rendering

import android.content.Context
import com.google.android.filament.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*

/** Auxiliary passes share one owner and restore targets before the main frame can be captured. */
internal class MapScenePipeline(context: Context, engine: Engine, scene: Scene, camera: Camera) :
    AutoCloseable {
    val materials = MapGpuMaterials(engine, context.assets)
    private val grid = MapSceneGrid(engine, scene, materials)
    private val layers = MapSceneLayers(engine, scene, camera, materials)
    private val colour = MapColourOutput(engine, materials)
    val pickingView
        get() = layers.pickingView

    fun updateGrid(document: JsonObject, enabled: Boolean) = grid.update(document, enabled)

    fun prepare(
        width: Int,
        height: Int,
        entries: List<MapSceneEntry>,
        selected: Boolean,
        pick: Boolean,
        density: Double,
        effects: MapSceneEffects,
        groups: Map<Int, MapSurfaceStyle>,
    ) {
        layers.prepare(width, height, groups.isNotEmpty(), selected, pick, density, groups)
        colour.prepare(width, height, effects.fogFrame)
    }

    fun render(
        renderer: Renderer,
        view: View,
        pick: Boolean,
        fog: Boolean,
        effects: MapSceneEffects,
    ) {
        if (pick) layers.renderPicking(renderer)
        colour.render(renderer, view) { r, v ->
            if (fog) effects.render(r, v, layers::render) else layers.render(r, v)
        }
    }

    override fun close() {
        grid.close()
        layers.close()
        colour.close()
        materials.close()
    }
}
