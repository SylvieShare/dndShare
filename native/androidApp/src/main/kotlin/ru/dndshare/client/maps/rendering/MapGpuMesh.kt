package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import java.nio.ByteBuffer
import java.nio.ByteOrder
import ru.dndshare.client.maps.geometry.*

/** Immutable shared geometry. Renderables own their materials, never these buffers. */
internal class MapGpuMesh(private val engine: Engine, mesh: MeshGeometry) : AutoCloseable {
    val vertices: VertexBuffer
    val indices: IndexBuffer
    val bounds: Box

    init {
        require(mesh.count > 0 && mesh.indices.isNotEmpty())
        fun floats(data: FloatArray) =
            ByteBuffer.allocateDirect(data.size * 4)
                .order(ByteOrder.nativeOrder())
                .asFloatBuffer()
                .apply {
                    put(data)
                    flip()
                }
        val positions = floats(mesh.positions)
        val triangles =
            ByteBuffer.allocateDirect(mesh.indices.size * 4)
                .order(ByteOrder.nativeOrder())
                .asIntBuffer()
                .apply {
                    put(mesh.indices)
                    flip()
                }
        val frame =
            SurfaceOrientation.Builder()
                .vertexCount(mesh.count)
                .normals(floats(mesh.normals))
                .positions(positions)
                .uvs(floats(mesh.uv))
                .triangleCount(mesh.indices.size / 3)
                .triangles_uint32(triangles)
                .build()
        val tangents =
            ByteBuffer.allocateDirect(mesh.count * 16)
                .order(ByteOrder.nativeOrder())
                .asFloatBuffer()
        try {
            frame.getQuatsAsFloat(tangents)
        } finally {
            frame.destroy()
        }
        tangents.rewind()
        val stride = 60
        val packed = ByteBuffer.allocateDirect(mesh.count * stride).order(ByteOrder.nativeOrder())
        for (i in 0 until mesh.count) {
            repeat(3) { packed.putFloat(mesh.positions[i * 3 + it]) }
            repeat(4) { packed.putFloat(tangents.get(i * 4 + it)) }
            repeat(2) { packed.putFloat(mesh.uv[i * 2 + it]) }
            repeat(4) { packed.putFloat(mesh.colors[i * 4 + it]) }
            repeat(2) { packed.putFloat(mesh.water[i * 2 + it]) }
        }
        packed.flip()
        vertices =
            VertexBuffer.Builder()
                .bufferCount(1)
                .vertexCount(mesh.count)
                .attribute(
                    VertexBuffer.VertexAttribute.POSITION,
                    0,
                    VertexBuffer.AttributeType.FLOAT3,
                    0,
                    stride,
                )
                .attribute(
                    VertexBuffer.VertexAttribute.TANGENTS,
                    0,
                    VertexBuffer.AttributeType.FLOAT4,
                    12,
                    stride,
                )
                .attribute(
                    VertexBuffer.VertexAttribute.UV0,
                    0,
                    VertexBuffer.AttributeType.FLOAT2,
                    28,
                    stride,
                )
                .attribute(
                    VertexBuffer.VertexAttribute.COLOR,
                    0,
                    VertexBuffer.AttributeType.FLOAT4,
                    36,
                    stride,
                )
                .attribute(
                    VertexBuffer.VertexAttribute.CUSTOM0,
                    0,
                    VertexBuffer.AttributeType.FLOAT2,
                    52,
                    stride,
                )
                .build(engine)
        vertices.setBufferAt(engine, 0, packed)
        indices =
            IndexBuffer.Builder()
                .indexCount(mesh.indices.size)
                .bufferType(IndexBuffer.Builder.IndexType.UINT)
                .build(engine)
        triangles.rewind()
        indices.setBuffer(engine, triangles)
        val low = FloatArray(3) { Float.POSITIVE_INFINITY }
        val high = FloatArray(3) { Float.NEGATIVE_INFINITY }
        for (i in mesh.positions.indices) {
            val axis = i % 3
            low[axis] = minOf(low[axis], mesh.positions[i])
            high[axis] = maxOf(high[axis], mesh.positions[i])
        }
        bounds =
            Box(
                FloatArray(3) { (low[it] + high[it]) / 2 },
                FloatArray(3) { maxOf(.001f, (high[it] - low[it]) / 2) },
            )
    }

    override fun close() {
        engine.destroyVertexBuffer(vertices)
        engine.destroyIndexBuffer(indices)
    }
}

internal class MapGpuEntity(
    private val engine: Engine,
    private val scene: Scene,
    mesh: MapGpuMesh,
    material: MaterialInstance,
    shadows: Boolean = false,
    priority: Int = 4,
    private val ownsMaterial: Boolean = true,
    private val releaseMaterial: (MaterialInstance) -> Unit = engine::destroyMaterialInstance,
    culling: Boolean = true,
) : AutoCloseable {
    var material = material
        private set

    private var layerMask = 1
    private var shown = true

    fun bindMaterial(value: MaterialInstance) {
        if (material.nativeObject == value.nativeObject) return
        engine.renderableManager.setMaterialInstanceAt(
            engine.renderableManager.getInstance(entity),
            0,
            value,
        )
        material = value
    }

    val entity = EntityManager.get().create()

    init {
        RenderableManager.Builder(1)
            .boundingBox(mesh.bounds)
            .geometry(0, RenderableManager.PrimitiveType.TRIANGLES, mesh.vertices, mesh.indices)
            .material(0, material)
            .castShadows(shadows)
            .receiveShadows(true)
            .culling(culling)
            .priority(priority)
            .layerMask(0xff, 1)
            .build(engine, entity)
        scene.addEntity(entity)
    }

    fun transform(matrix: FloatArray) {
        engine.transformManager.setTransform(engine.transformManager.getInstance(entity), matrix)
    }

    fun layer(value: Int) {
        layerMask = value
        engine.renderableManager.setLayerMask(
            engine.renderableManager.getInstance(entity),
            0xff,
            if (shown) value else 0,
        )
    }

    fun visible(value: Boolean) {
        shown = value
        engine.renderableManager.setLayerMask(
            engine.renderableManager.getInstance(entity),
            0xff,
            if (value) layerMask else 0,
        )
    }

    override fun close() {
        scene.remove(entity)
        engine.destroyEntity(entity)
        EntityManager.get().destroy(entity)
        if (ownsMaterial) releaseMaterial(material)
    }
}
