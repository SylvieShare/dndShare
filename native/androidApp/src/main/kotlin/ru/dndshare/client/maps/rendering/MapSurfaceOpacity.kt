package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import ru.dndshare.client.maps.geometry.MeshGeometry

internal data class MapSurfaceStyle(val opacity: Float = 1f, val brightness: Float = 1f)

/** Alpha-only quads run after the PBR surfaces in the same depth/stencil pass. */
internal class MapSurfaceOpacity(
    private val engine: Engine,
    private val scene: Scene,
    private val gpu: MapGpuMaterials,
) : AutoCloseable {
    private var mesh: MapGpuMesh? = null
    private val pulses = mutableMapOf<Int, Pair<MapGpuEntity, MapGpuEntity>>()
    private val masks = mutableMapOf<Int, MapGpuEntity>()

    fun update(groups: Map<Int, MapSurfaceStyle>) {
        masks.keys.filter { it !in groups }.forEach { masks.remove(it)?.close() }
        pulses.keys
            .filter { it !in groups }
            .forEach {
                pulses.remove(it)?.let {
                    it.first.close()
                    it.second.close()
                }
            }
        for ((id, style) in groups) {
            val mask =
                masks.getOrPut(id) {
                    val geometry =
                        mesh
                            ?: MapGpuMesh(
                                    engine,
                                    MeshGeometry(
                                        floatArrayOf(
                                            -1f,
                                            -1f,
                                            0f,
                                            1f,
                                            -1f,
                                            0f,
                                            1f,
                                            1f,
                                            0f,
                                            -1f,
                                            1f,
                                            0f,
                                        ),
                                        floatArrayOf(
                                            0f,
                                            0f,
                                            1f,
                                            0f,
                                            0f,
                                            1f,
                                            0f,
                                            0f,
                                            1f,
                                            0f,
                                            0f,
                                            1f,
                                        ),
                                        floatArrayOf(0f, 0f, 1f, 0f, 1f, 1f, 0f, 1f),
                                        FloatArray(16) { 1f },
                                        FloatArray(8),
                                        intArrayOf(0, 1, 2, 0, 2, 3),
                                    ),
                                )
                                .also { mesh = it }
                    val material =
                        gpu.configure("surface-opacity") {
                            it.setStencilWrite(false)
                            it.setStencilCompareFunction(TextureSampler.CompareFunc.E)
                            it.setStencilReferenceValue(id)
                            it.setStencilReadMask(255)
                        }
                    MapGpuEntity(engine, scene, geometry, material, priority = 7, culling = false)
                        .also { it.layer(8) }
                }
            mask.material.setParameter("opacity", style.opacity)
            if (style.brightness > 1f) {
                val pulse =
                    pulses.getOrPut(id) {
                        pulse(id, "surface-flash-multiply", 6) to pulse(id, "surface-flash-add", 7)
                    }
                pulse.first.material.setParameter("brightness", style.brightness)
                pulse.second.material.setParameter("brightness", style.brightness)
            } else
                pulses.remove(id)?.let {
                    it.first.close()
                    it.second.close()
                }
        }
    }

    private fun pulse(id: Int, name: String, priority: Int): MapGpuEntity {
        val material =
            gpu.configure(name) {
                it.setStencilWrite(false)
                it.setStencilCompareFunction(TextureSampler.CompareFunc.E)
                it.setStencilReferenceValue(id)
                it.setStencilReadMask(255)
            }
        return MapGpuEntity(
                engine,
                scene,
                requireNotNull(mesh),
                material,
                priority = priority,
                culling = false,
            )
            .also { it.layer(8) }
    }

    override fun close() {
        pulses.values.forEach {
            it.first.close()
            it.second.close()
        }
        pulses.clear()
        masks.values.forEach(MapGpuEntity::close)
        masks.clear()
        mesh?.close()
        mesh = null
    }
}
