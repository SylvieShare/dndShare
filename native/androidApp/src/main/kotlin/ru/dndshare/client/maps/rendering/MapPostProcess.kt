package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import ru.dndshare.client.maps.geometry.MeshGeometry

internal class MapPostProcess(private val engine: Engine, gpu: MapGpuMaterials, name: String) :
    AutoCloseable {
    val scene = engine.createScene()
    private val camera = engine.createCamera(EntityManager.get().create())
    val view =
        engine.createView().apply {
            this.scene = this@MapPostProcess.scene
            this.camera = this@MapPostProcess.camera
            isPostProcessingEnabled = false
            isShadowingEnabled = false
        }
    val material = gpu.instance(name)
    private val mesh =
        MapGpuMesh(
            engine,
            MeshGeometry(
                floatArrayOf(-1f, -1f, 0f, 1f, -1f, 0f, 1f, 1f, 0f, -1f, 1f, 0f),
                FloatArray(12) { if (it % 3 == 2) 1f else 0f },
                floatArrayOf(0f, 0f, 1f, 0f, 1f, 1f, 0f, 1f),
                FloatArray(16) { 1f },
                FloatArray(8),
                intArrayOf(0, 1, 2, 0, 2, 3),
            ),
        )
    private val entity = MapGpuEntity(engine, scene, mesh, material)

    init {
        camera.setExposure(1f)
    }

    override fun close() {
        entity.close()
        mesh.close()
        engine.destroyView(view)
        engine.destroyCameraComponent(camera.entity)
        EntityManager.get().destroy(camera.entity)
        engine.destroyScene(scene)
    }
}

internal class MapFrameTarget(
    private val engine: Engine,
    val width: Int,
    val height: Int,
    depth: Boolean,
    format: Texture.InternalFormat,
) : AutoCloseable {
    val colour =
        Texture.Builder()
            .width(width)
            .height(height)
            .levels(1)
            .sampler(Texture.Sampler.SAMPLER_2D)
            .format(format)
            .usage(Texture.Usage.COLOR_ATTACHMENT or Texture.Usage.SAMPLEABLE)
            .build(engine)
    val depth =
        if (depth)
            Texture.Builder()
                .width(width)
                .height(height)
                .levels(1)
                .sampler(Texture.Sampler.SAMPLER_2D)
                .format(Texture.InternalFormat.DEPTH24)
                .usage(Texture.Usage.DEPTH_ATTACHMENT or Texture.Usage.SAMPLEABLE)
                .build(engine)
        else null
    val target =
        RenderTarget.Builder()
            .texture(RenderTarget.AttachmentPoint.COLOR, colour)
            .apply {
                this@MapFrameTarget.depth?.let { texture(RenderTarget.AttachmentPoint.DEPTH, it) }
            }
            .build(engine)

    override fun close() {
        engine.destroyRenderTarget(target)
        engine.destroyTexture(colour)
        depth?.let(engine::destroyTexture)
    }
}
