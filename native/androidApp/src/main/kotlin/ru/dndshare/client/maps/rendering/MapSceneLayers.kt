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

    private val ghostView = worldView(2 or 8 or 128).apply { isStencilBufferEnabled = true }
    val pickingView =
        worldView(1 or 2 or 16).apply {
            isShadowingEnabled = false
            isTransparentPickingEnabled = true
        }
    private val opacity = MapSurfaceOpacity(engine, sourceScene, gpu)
    private val composite =
        MapPostProcess(engine, gpu, "surfaces", sourceScene, sourceCamera, 32, 0).apply {
            view.isShadowingEnabled = true
            view.setDynamicLightingOptions(.01f, 2000f)
        }
    private var world: MapFrameTarget? = null
    private var ghost: MapFrameTarget? = null
    private var picking: MapFrameTarget? = null
    private var ghosts = false
    private var materials = MapRenderMaterials()

    fun prepare(
        width: Int,
        height: Int,
        ghosts: Boolean,
        pick: Boolean,
        groups: Map<Int, MapSurfaceStyle>,
        materials: MapRenderMaterials,
    ) {
        opacity.update(groups)
        this.ghosts = ghosts
        this.materials = materials
        if (width <= 0 || height <= 0) return
        pickingView.viewport = Viewport(0, 0, width, height)
        if (ghosts && (world?.width != width || world?.height != height)) {
            releaseWorld()
            world = MapFrameTarget(engine, width, height, true, Texture.InternalFormat.RGBA16F)
            ghost =
                MapFrameTarget(
                    engine,
                    width,
                    height,
                    true,
                    Texture.InternalFormat.RGBA16F,
                    Texture.InternalFormat.DEPTH24_STENCIL8,
                )
        } else if (!ghosts) releaseWorld()
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
            setParameter("ghostEnabled", if (ghosts) 1f else 0f)
        }
    }

    fun renderPicking(renderer: Renderer) {
        if (picking != null) renderer.render(pickingView)
    }

    fun render(renderer: Renderer, view: View) {
        val target = world
        if (target == null) {
            view.setVisibleLayers(255, 1 or 16 or 64 or 128)
            renderer.render(view)
            return
        }
        val old = view.renderTarget
        val post = view.isPostProcessingEnabled
        val visible = view.visibleLayers
        try {
            view.renderTarget = target.target
            view.isPostProcessingEnabled = false
            view.setVisibleLayers(255, if (ghosts) 1 or 128 else 1 or 16 or 64 or 128)
            renderer.render(view)
            if (ghosts) renderer.render(ghostView)
            composite.view.renderTarget = old
            composite.view.setVisibleLayers(
                255,
                if (ghosts) 1 or 2 or 16 or 32 or 64 or 128 else 32,
            )
            composite.view.isPostProcessingEnabled = post
            composite.view.antiAliasing =
                if (post) View.AntiAliasing.FXAA else View.AntiAliasing.NONE
            if (ghosts) materials.alphaOnly { renderer.render(composite.view) }
            else renderer.render(composite.view)
        } finally {
            view.renderTarget = old
            view.isPostProcessingEnabled = post
            view.setVisibleLayers(255, visible)
        }
    }

    private fun releaseWorld() {
        ghostView.renderTarget = null
        composite.view.renderTarget = null
        world?.close()
        world = null
        ghost?.close()
        ghost = null
    }

    override fun close() {
        opacity.close()
        releaseWorld()
        pickingView.renderTarget = null
        picking?.close()
        picking = null
        engine.destroyView(ghostView)
        engine.destroyView(pickingView)
        composite.close()
    }
}
