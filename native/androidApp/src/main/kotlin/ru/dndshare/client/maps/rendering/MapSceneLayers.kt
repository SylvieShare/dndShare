package ru.dndshare.client.maps.rendering

import com.google.android.filament.*

/** Views share uploaded geometry and PBR materials. Depth isolates the nearest ghost surface. */
internal class MapSceneLayers(
    private val engine: Engine,
    private val sourceScene: Scene,
    private val sourceCamera: Camera,
    gpu: MapGpuMaterials,
) : AutoCloseable {
    private fun worldView(layers: Int) =
        engine.createView().apply {
            this.scene = sourceScene
            this.camera = sourceCamera
            setVisibleLayers(0xff, layers)
            isPostProcessingEnabled = false
            setDynamicLightingOptions(.01f, 2000f)
        }

    private val ghostView = worldView(2)
    private val selectionView = worldView(4).apply { isShadowingEnabled = false }
    val pickingView = worldView(3).apply { isShadowingEnabled = false }
    private val composite = MapPostProcess(engine, gpu, "surfaces")
    private var world: MapFrameTarget? = null
    private var ghost: MapFrameTarget? = null
    private var selection: MapFrameTarget? = null
    private var picking: MapFrameTarget? = null
    private var ghosts = false
    private var selected = false

    fun prepare(
        width: Int,
        height: Int,
        ghosts: Boolean,
        selected: Boolean,
        pick: Boolean,
        density: Double,
    ) {
        this.ghosts = ghosts
        this.selected = selected
        if (width <= 0 || height <= 0) return
        pickingView.viewport = Viewport(0, 0, width, height)
        if ((ghosts || selected) && (world?.width != width || world?.height != height)) {
            releaseSurfaces()
            world = MapFrameTarget(engine, width, height, true, Texture.InternalFormat.RGBA16F)
            ghost = MapFrameTarget(engine, width, height, true, Texture.InternalFormat.RGBA16F)
            selection = MapFrameTarget(engine, width, height, true, Texture.InternalFormat.R8)
        } else if (!ghosts && !selected) releaseSurfaces()
        if (pick && (picking?.width != width || picking?.height != height)) {
            pickingView.renderTarget = null
            picking?.close()
            picking = MapFrameTarget(engine, width, height, true, Texture.InternalFormat.R8)
        }
        picking?.let {
            pickingView.viewport = Viewport(0, 0, width, height)
            pickingView.renderTarget = it.target
        }
        if (world == null) return
        ghostView.viewport = Viewport(0, 0, width, height)
        ghostView.renderTarget = ghost!!.target
        selectionView.viewport = Viewport(0, 0, width, height)
        selectionView.renderTarget = selection!!.target
        composite.view.viewport = Viewport(0, 0, width, height)
        val sample =
            TextureSampler(
                TextureSampler.MinFilter.NEAREST,
                TextureSampler.MagFilter.NEAREST,
                TextureSampler.WrapMode.CLAMP_TO_EDGE,
            )
        composite.material.apply {
            setParameter("worldColour", world!!.colour, sample)
            setParameter("worldDepth", world!!.depth, sample)
            setParameter("ghostColour", ghost!!.colour, sample)
            setParameter("ghostDepth", ghost!!.depth, sample)
            setParameter("selectedDepth", selection!!.depth, sample)
            setParameter("pixelSize", 1f / width, 1f / height)
            setParameter("ghostEnabled", if (ghosts) 1f else 0f)
            setParameter("outlineEnabled", if (selected) 1f else 0f)
            setParameter("outlineWidth", (density * 1.5).toFloat())
            val colour = mapLinearColour("#c1adf1")
            setParameter("outlineColour", colour[0], colour[1], colour[2])
        }
    }

    fun renderPicking(renderer: Renderer) {
        if (picking != null) renderer.render(pickingView)
    }

    fun render(renderer: Renderer, view: View) {
        val target = world
        if (target == null) {
            renderer.render(view)
            return
        }
        val old = view.renderTarget
        val post = view.isPostProcessingEnabled
        try {
            view.renderTarget = target.target
            view.isPostProcessingEnabled = false
            renderer.render(view)
            if (ghosts) renderer.render(ghostView)
            if (selected) renderer.render(selectionView)
            composite.view.renderTarget = old
            composite.view.isPostProcessingEnabled = post
            composite.view.antiAliasing =
                if (post) View.AntiAliasing.FXAA else View.AntiAliasing.NONE
            renderer.render(composite.view)
        } finally {
            view.renderTarget = old
            view.isPostProcessingEnabled = post
        }
    }

    private fun releaseSurfaces() {
        ghostView.renderTarget = null
        selectionView.renderTarget = null
        composite.view.renderTarget = null
        world?.close()
        world = null
        ghost?.close()
        ghost = null
        selection?.close()
        selection = null
    }

    override fun close() {
        releaseSurfaces()
        pickingView.renderTarget = null
        picking?.close()
        picking = null
        engine.destroyView(ghostView)
        engine.destroyView(selectionView)
        engine.destroyView(pickingView)
        composite.close()
    }
}
