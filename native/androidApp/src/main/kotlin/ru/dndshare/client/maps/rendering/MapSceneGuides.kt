package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import java.nio.ByteBuffer
import java.nio.ByteOrder
import ru.dndshare.client.maps.MapModelGuides

/** Reference geometry guides share the scene depth, without flattening them onto the UI layer. */
internal class MapSceneGuides(
    private val engine: Engine,
    private val scene: Scene,
    private val gpu: MapGpuMaterials,
) : AutoCloseable {
    private var last: MapModelGuides? = null
    private var vertices: VertexBuffer? = null
    private var indices: IndexBuffer? = null
    private var material: MaterialInstance? = null
    private var entity: Int? = null

    fun update(value: MapModelGuides?) {
        if (last == value) return
        last = value
        clear()
        val lines = value?.lines.orEmpty()
        if (lines.isEmpty()) return
        val count = lines.size * 2
        val stride = 28
        val packed = ByteBuffer.allocateDirect(count * stride).order(ByteOrder.nativeOrder())
        val elements =
            ByteBuffer.allocateDirect(count * 4).order(ByteOrder.nativeOrder()).asIntBuffer()
        val low = FloatArray(3) { Float.POSITIVE_INFINITY }
        val high = FloatArray(3) { Float.NEGATIVE_INFINITY }
        var index = 0
        for (line in lines) {
            val colour = mapLinearColour(line.colour)
            for (point in listOf(line.a, line.b)) {
                val position =
                    floatArrayOf(point.x.toFloat(), point.elevation.toFloat(), point.y.toFloat())
                for (axis in 0..2) {
                    packed.putFloat(position[axis])
                    low[axis] = minOf(low[axis], position[axis])
                    high[axis] = maxOf(high[axis], position[axis])
                }
                repeat(3) { packed.putFloat(colour[it] * line.opacity) }
                packed.putFloat(line.opacity)
                elements.put(index++)
            }
        }
        packed.flip()
        elements.flip()
        val vertex =
            VertexBuffer.Builder()
                .bufferCount(1)
                .vertexCount(count)
                .attribute(
                    VertexBuffer.VertexAttribute.POSITION,
                    0,
                    VertexBuffer.AttributeType.FLOAT3,
                    0,
                    stride,
                )
                .attribute(
                    VertexBuffer.VertexAttribute.COLOR,
                    0,
                    VertexBuffer.AttributeType.FLOAT4,
                    12,
                    stride,
                )
                .build(engine)
        vertices = vertex
        vertex.setBufferAt(engine, 0, packed)
        val element =
            IndexBuffer.Builder()
                .indexCount(count)
                .bufferType(IndexBuffer.Builder.IndexType.UINT)
                .build(engine)
        indices = element
        element.setBuffer(engine, elements)
        val instance = gpu.instance("guides")
        material = instance
        val id = EntityManager.get().create()
        entity = id
        RenderableManager.Builder(1)
            .boundingBox(
                Box(
                    FloatArray(3) { (low[it] + high[it]) / 2 },
                    FloatArray(3) { maxOf(.001f, (high[it] - low[it]) / 2) },
                )
            )
            .geometry(0, RenderableManager.PrimitiveType.LINES, vertex, element)
            .material(0, instance)
            .castShadows(false)
            .receiveShadows(false)
            .layerMask(255, 64)
            .priority(7)
            .build(engine, id)
        scene.addEntity(id)
    }

    private fun clear() {
        entity?.let {
            scene.remove(it)
            engine.destroyEntity(it)
            EntityManager.get().destroy(it)
        }
        entity = null
        material?.let(gpu::release)
        material = null
        vertices?.let(engine::destroyVertexBuffer)
        vertices = null
        indices?.let(engine::destroyIndexBuffer)
        indices = null
    }

    override fun close() {
        clear()
        last = null
    }
}
