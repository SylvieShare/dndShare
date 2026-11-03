package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import ru.dndshare.client.maps.MapEntityRef

internal data class MapOutlineFrame(
    val selected: Set<MapEntityRef>,
    val hovered: Set<MapEntityRef>,
    val revision: Long,
    val moving: Boolean,
)

/** Cached depth masks share the actual renderables; light-only frames just reuse their textures. */
internal class MapOutlineMasks(private val engine: Engine, scene: Scene, camera: Camera) :
    AutoCloseable {
    private val view =
        engine.createView().apply {
            this.scene = scene
            this.camera = camera
            setVisibleLayers(255, 4)
            isPostProcessingEnabled = false
            isShadowingEnabled = false
        }
    private var selected: MapFrameTarget? = null
    private var hovered: MapFrameTarget? = null
    private var frame = MapOutlineFrame(emptySet(), emptySet(), -1, false)
    private var previous: MapOutlineFrame? = null
    private var dirty = true
    var builds = 0L
        private set

    val selectedDepth
        get() = selected?.depth

    val hoveredDepth
        get() = hovered?.depth

    fun prepare(width: Int, height: Int, value: MapOutlineFrame) {
        if (width <= 0 || height <= 0) return
        fun target(old: MapFrameTarget?, enabled: Boolean): MapFrameTarget? {
            if (!enabled && old == null) return null
            if (enabled && old?.width == width && old.height == height) return old
            view.renderTarget = null
            old?.close()
            dirty = true
            return if (enabled)
                MapFrameTarget(engine, width, height, true, Texture.InternalFormat.R8)
            else null
        }
        selected = target(selected, value.selected.isNotEmpty())
        hovered = target(hovered, value.hovered.isNotEmpty())
        frame = value
        view.viewport = Viewport(0, 0, width, height)
    }

    fun render(
        renderer: Renderer,
        materials: MapRenderMaterials,
        highlight: (Set<MapEntityRef>) -> Unit,
    ) {
        val value = frame
        if (!dirty && value == previous && !value.moving) return
        try {
            materials.selectionDepth {
                for ((target, refs) in
                    listOf(selected to value.selected, hovered to value.hovered)) {
                    if (target == null) continue
                    highlight(refs)
                    view.renderTarget = target.target
                    renderer.render(view)
                    builds++
                }
            }
            previous = value.copy(moving = false)
            dirty = false
        } finally {
            highlight(value.selected)
            view.renderTarget = null
        }
    }

    override fun close() {
        view.renderTarget = null
        selected?.close()
        hovered?.close()
        selected = null
        hovered = null
        engine.destroyView(view)
    }
}
