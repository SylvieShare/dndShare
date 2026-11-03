package ru.dndshare.client.maps.rendering

import com.google.android.filament.*

internal data class MapFogFrame(
    val colour: Texture,
    val depth: Texture,
    val fog: Texture,
    val width: Int,
    val height: Int,
    val depthRange: Float,
)

/** Shared web ACES fit, background bypass, then native sRGB/FXAA/dithering exactly once. */
internal class MapColourOutput(private val engine: Engine, gpu: MapGpuMaterials) : AutoCloseable {
    private val output = MapPostProcess(engine, gpu, "colour")
    private val grading =
        ColorGrading.Builder()
            .toneMapper(ToneMapper.Linear())
            .luminanceScaling(false)
            .gamutMapping(false)
            .quality(ColorGrading.QualityLevel.HIGH)
            .build(engine)
    private var world: MapFrameTarget? = null

    fun prepare(width: Int, height: Int, fog: MapFogFrame?) {
        if (width <= 0 || height <= 0) return
        if (world?.width != width || world?.height != height) {
            output.view.renderTarget = null
            world?.close()
            world = MapFrameTarget(engine, width, height, true, Texture.InternalFormat.RGBA16F)
        }
        val frame = world!!
        output.view.viewport = Viewport(0, 0, width, height)
        output.view.isPostProcessingEnabled = true
        output.view.antiAliasing = View.AntiAliasing.FXAA
        output.view.colorGrading = grading
        val sample =
            TextureSampler(
                TextureSampler.MinFilter.LINEAR,
                TextureSampler.MagFilter.LINEAR,
                TextureSampler.WrapMode.CLAMP_TO_EDGE,
            )
        output.material.apply {
            setParameter("sceneColour", frame.colour, sample)
            setParameter("sourceColour", fog?.colour ?: frame.colour, sample)
            setParameter("sourceDepth", fog?.depth ?: frame.depth, sample)
            setParameter("fogData", fog?.fog ?: frame.colour, sample)
            setParameter("hasFog", if (fog == null) 0f else 1f)
            setParameter("fogSize", (fog?.width ?: 1).toFloat(), (fog?.height ?: 1).toFloat())
            setParameter("depthRange", fog?.depthRange ?: 1f)
            val colour = mapLinearColour("#161b23")
            setParameter("backgroundColour", colour[0], colour[1], colour[2])
        }
    }

    fun render(renderer: Renderer, view: View, draw: (Renderer, View) -> Unit) {
        val frame = world ?: return
        val old = view.renderTarget
        val post = view.isPostProcessingEnabled
        try {
            view.renderTarget = frame.target
            view.isPostProcessingEnabled = false
            draw(renderer, view)
            output.view.renderTarget = old
            renderer.render(output.view)
        } finally {
            view.renderTarget = old
            view.isPostProcessingEnabled = post
        }
    }

    override fun close() {
        output.view.colorGrading = null
        output.view.renderTarget = null
        world?.close()
        world = null
        output.close()
        engine.destroyColorGrading(grading)
    }
}
