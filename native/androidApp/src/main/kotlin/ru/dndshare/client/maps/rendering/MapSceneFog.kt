package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import java.nio.ByteBuffer
import kotlin.math.*
import kotlinx.coroutines.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*

/** Half-resolution volume pass and depth-aware composition share the world's depth buffer. */
internal class MapSceneFog(
    private val engine: Engine,
    private val gpu: MapGpuMaterials,
    private val scope: CoroutineScope,
    private val changed: () -> Unit,
    private val error: (String?) -> Unit,
) : AutoCloseable {
    private var fog: MapPostProcess? = null
    private var composite: MapPostProcess? = null
    private var world: MapFrameTarget? = null
    private var target: MapFrameTarget? = null
    private var density: Texture? = null
    private var noise: Texture? = null
    private var field: VolumeFogField? = null
    private var building: Job? = null
    private var signature = ""
    private var closed = false
    private var clock = 0.0
    private var previousTime: Double? = null
    private var sky = 1f
    private var sun = Vec3(-.4f, .8f, -.5f).normalized()
    val ready
        get() = field != null

    fun update(context: MapContext) {
        val document = context.document
        val sunlight = document["sun"] as? kotlinx.serialization.json.JsonObject
        sky =
            if (!document.flag("lightingEnabled") || sunlight?.flag("enabled", true) == true) 1f
            else .28f
        if (document.flag("lightingEnabled") && sunlight?.flag("enabled", true) == true) {
            val angle = Math.toRadians(sunlight.number("angle", 225.0))
            val elevation = Math.toRadians(sunlight.number("elevation", 45.0))
            sun =
                Vec3(
                    (sin(angle) * cos(elevation)).toFloat(),
                    sin(elevation).toFloat(),
                    (cos(angle) * cos(elevation)).toFloat(),
                )
        } else sun = Vec3(-.4f, .8f, -.5f).normalized()
        val columns = mapFogColumns(context)
        val key = columns.joinToString { "${it.areaId}:${it.min.toList()}:${it.max.toList()}" }
        if (key == signature) return
        signature = key
        building?.cancel()
        if (columns.isEmpty()) {
            releaseField()
            changed()
            return
        }
        building = scope.launch {
            try {
                val prepared = withContext(Dispatchers.Default) { buildMapFogField(columns) }
                if (closed || key != signature) return@launch
                releaseField()
                field = prepared
                if (prepared != null) {
                    density = volume(prepared.data, prepared.dimensions)
                    noise = volume(mapFogNoise(), intArrayOf(32, 32, 32))
                }
                changed()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                signature = ""
                error(failure.message)
            }
        }
    }

    private fun volume(bytes: ByteArray, size: IntArray): Texture {
        val texture =
            Texture.Builder()
                .width(size[0])
                .height(size[1])
                .depth(size[2])
                .levels(1)
                .sampler(Texture.Sampler.SAMPLER_2D_ARRAY)
                .format(Texture.InternalFormat.R8)
                .build(engine)
        val buffer =
            ByteBuffer.allocateDirect(bytes.size).apply {
                put(bytes)
                flip()
            }
        texture.setImage(
            engine,
            0,
            0,
            0,
            0,
            size[0],
            size[1],
            size[2],
            Texture.PixelBufferDescriptor(buffer, Texture.Format.R, Texture.Type.UBYTE, 1),
        )
        return texture
    }

    fun prepare(
        view: View,
        camera: Camera,
        seconds: Double,
        motion: Boolean,
    ): Boolean {
        val current = field ?: return false
        val width = view.viewport.width
        val height = view.viewport.height
        if (width <= 0 || height <= 0) return false
        if (world?.width != width || world?.height != height) {
            releaseTargets()
            world = MapFrameTarget(engine, width, height, true, Texture.InternalFormat.RGBA16F)
            target =
                MapFrameTarget(
                    engine,
                    (width + 1) / 2,
                    (height + 1) / 2,
                    false,
                    Texture.InternalFormat.RG8,
                )
        }
        val frame = requireNotNull(world)
        val half = requireNotNull(target)
        val mist =
            fog
                ?: MapPostProcess(engine, gpu, "fog").also {
                    fog = it
                }
        val output =
            composite
                ?: MapPostProcess(engine, gpu, "composite").also {
                    composite = it
                    it.view.isPostProcessingEnabled = true
                    it.view.antiAliasing = View.AntiAliasing.FXAA
                }
        val sample =
            TextureSampler(
                TextureSampler.MinFilter.LINEAR,
                TextureSampler.MagFilter.LINEAR,
                TextureSampler.WrapMode.CLAMP_TO_EDGE,
            )
        val repeat =
            TextureSampler(
                TextureSampler.MinFilter.LINEAR,
                TextureSampler.MagFilter.LINEAR,
                TextureSampler.WrapMode.REPEAT,
            )
        mist.material.setParameter("sceneDepth", frame.depth, sample)
        mist.material.setParameter("densityField", density, sample)
        mist.material.setParameter("noiseField", noise, repeat)
        val inverse =
            Mat4.multiply(
                camera.getModelMatrix(null).map(Double::toFloat).toFloatArray(),
                Mat4.inverse(camera.getProjectionMatrix(null).map(Double::toFloat).toFloatArray()),
            )
        mist.material.setParameter("inverseViewProjection", inverse)
        val origin = Mat4.point(inverse, Vec3(0f, 0f, -1f))
        val end = Mat4.point(inverse, Vec3(0f, 0f, 1f))
        val direction = (end - origin).normalized()
        mist.material.setParameter("rayDirection", direction.x, direction.y, direction.z)
        mist.material.setParameter(
            "boundsMin",
            current.min[0].toFloat(),
            current.min[1].toFloat(),
            current.min[2].toFloat(),
        )
        mist.material.setParameter(
            "boundsSize",
            current.size[0].toFloat(),
            current.size[1].toFloat(),
            current.size[2].toFloat(),
        )
        mist.material.setParameter(
            "fieldSize",
            current.dimensions[0].toFloat(),
            current.dimensions[1].toFloat(),
            current.dimensions[2].toFloat(),
        )
        mist.material.setParameter("sunDirection", sun.x, sun.y, sun.z)
        output.material.setParameter("skyLight", sky)
        if (motion) {
            previousTime?.let { clock = (clock + (seconds - it).coerceIn(0.0, .25)) % 10000 }
            previousTime = seconds
        } else {
            clock = 0.0
            previousTime = null
        }
        mist.material.setParameter("clock", (floor(clock * 10) / 10).toFloat())
        output.material.setParameter("sceneColour", frame.colour, sample)
        output.material.setParameter("sceneDepth", frame.depth, sample)
        output.material.setParameter("fogColour", half.colour, sample)
        output.material.setParameter("fogSize", half.width.toFloat(), half.height.toFloat())
        output.material.setParameter("depthRange", sqrt((end - origin).dot(end - origin)))
        mist.view.viewport = Viewport(0, 0, half.width, half.height)
        mist.view.renderTarget = half.target
        output.view.viewport = Viewport(0, 0, width, height)
        output.view.renderTarget = view.renderTarget
        return true
    }

    fun render(renderer: Renderer, view: View): Boolean {
        val frame = world ?: return false
        val mist = fog ?: return false
        val output = composite ?: return false
        val oldTarget = view.renderTarget
        val post = view.isPostProcessingEnabled
        try {
            view.renderTarget = frame.target
            view.isPostProcessingEnabled = false
            renderer.render(view)
            renderer.render(mist.view)
            renderer.render(output.view)
        } finally {
            view.renderTarget = oldTarget
            view.isPostProcessingEnabled = post
        }
        return true
    }

    private fun releaseTargets() {
        fog?.view?.renderTarget = null
        world?.close()
        target?.close()
        world = null
        target = null
    }

    private fun releaseField() {
        field = null
        density?.let(engine::destroyTexture)
        density = null
        noise?.let(engine::destroyTexture)
        noise = null
        releaseTargets()
    }

    override fun close() {
        closed = true
        building?.cancel()
        releaseField()
        fog?.close()
        composite?.close()
    }
}
