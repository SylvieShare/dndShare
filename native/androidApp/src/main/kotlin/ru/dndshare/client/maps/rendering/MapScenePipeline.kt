package ru.dndshare.client.maps.rendering

import android.content.Context
import com.google.android.filament.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*

/** Auxiliary passes share one owner and restore targets before the main frame can be captured. */
internal class MapScenePipeline(context: Context, engine: Engine, scene: Scene, camera: Camera) :
    AutoCloseable {
    val materials = MapGpuMaterials(engine, context.assets)
    private val guides = MapSceneGuides(engine, scene, materials)

    fun guides(value: MapModelGuides?) = guides.update(value)

    private val grid = MapSceneGrid(engine, scene, materials)
    private val layers = MapSceneLayers(engine, scene, camera, materials)
    private val colour = MapColourOutput(engine, materials)
    private val outlines = MapOutlineMasks(engine, scene, camera)
    private var renderMaterials = MapRenderMaterials()
    private var highlight: (Set<MapEntityRef>) -> Unit = {}
    val outlineBuilds
        get() = outlines.builds

    val pickingView
        get() = layers.pickingView

    fun updateGrid(document: JsonObject, enabled: Boolean) = grid.update(document, enabled)

    fun prepare(
        width: Int,
        height: Int,
        entries: List<MapSceneEntry>,
        outline: MapOutlineFrame,
        pick: Boolean,
        density: Double,
        effects: MapSceneEffects,
        groups: Map<Int, MapSurfaceStyle>,
        materials: MapRenderMaterials,
        outlineColour: String = "#c1adf1",
        highlight: (Set<MapEntityRef>) -> Unit,
    ) {
        this.renderMaterials = materials
        this.highlight = highlight
        outlines.prepare(width, height, outline)
        layers.prepare(
            width,
            height,
            groups.isNotEmpty(),
            pick,
            groups,
            materials,
        )
        colour.prepare(
            width,
            height,
            effects.fogFrame,
            outlines.selectedDepth,
            density,
            outlineColour,
            outlines.hoveredDepth,
        )
    }

    fun render(
        renderer: Renderer,
        view: View,
        pick: Boolean,
        fog: Boolean,
        effects: MapSceneEffects,
        profiler: MapFrameProfiler? = null,
    ) {
        outlines.render(renderer, renderMaterials, highlight)
        profiler?.mark("outlines")
        if (pick) layers.renderPicking(renderer)
        profiler?.mark("picking")
        colour.render(renderer, view) { r, v ->
            if (fog)
                effects.render(r, v) { rr, vv ->
                    layers.render(rr, vv)
                    profiler?.mark("draw")
                }
            else layers.render(r, v)
            profiler?.mark(if (fog) "fog" else "draw")
        }
        profiler?.mark("presentation")
    }

    override fun close() {
        guides.close()
        grid.close()
        outlines.close()
        layers.close()
        colour.close()
        materials.close()
    }
}
