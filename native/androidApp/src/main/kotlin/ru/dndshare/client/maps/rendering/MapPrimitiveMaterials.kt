package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import com.google.android.filament.gltfio.*

internal data class MapPrimitiveRef(val node: Int, val primitive: Int)

/** Replace only the exact water primitives once their native material is ready. */
internal class MapPrimitiveMaterials(private val engine: Engine, private val gpu: MapGpuMaterials) :
    AutoCloseable {
    private data class Binding(
        val renderable: Int,
        val ref: MapPrimitiveRef,
        val original: MaterialInstance,
    )

    private val stencil = MapStencilMaterials(engine, gpu)
    private val groupIds = mutableMapOf<FilamentInstance, Int>()
    private val bindings = mutableMapOf<FilamentInstance, List<Binding>>()
    private var discard: MaterialInstance? = null
    private val applied = mutableMapOf<FilamentInstance, Set<MapPrimitiveRef>>()

    fun apply(
        asset: FilamentAsset,
        instance: FilamentInstance,
        water: Set<MapPrimitiveRef>,
        group: Int = 0,
    ) {
        if (applied[instance] == water && groupIds[instance] == group) return
        val manager = engine.renderableManager
        val rows =
            bindings.getOrPut(instance) {
                instance.entities.flatMap { entity ->
                    val node =
                        asset
                            .getName(entity)
                            ?.takeIf { it.startsWith(MAP_NODE_NAME) }
                            ?.removePrefix(MAP_NODE_NAME)
                            ?.toIntOrNull()
                    val renderable = manager.getInstance(entity)
                    if (node == null || renderable == 0) emptyList()
                    else
                        (0 until manager.getPrimitiveCount(renderable)).map { primitive ->
                            Binding(
                                renderable,
                                MapPrimitiveRef(node, primitive),
                                manager.getMaterialInstanceAt(renderable, primitive),
                            )
                        }
                }
            }
        require(water.all { ref -> rows.any { it.ref == ref } }) {
            "Не удалось сопоставить поверхность воды с GLB"
        }
        applied[instance] = water
        groupIds[instance] = group
        for (binding in rows) manager.setMaterialInstanceAt(
            binding.renderable,
            binding.ref.primitive,
            if (binding.ref in water) discard ?: gpu.instance("discard").also { discard = it }
            else stencil.material(binding.original, group),
        )
    }

    fun forget(instances: Collection<FilamentInstance>) {
        // Filament requires every renderable to release a copied material before destruction.
        val manager = engine.renderableManager
        for (instance in instances) for (binding in bindings[instance].orEmpty()) {
            manager.setMaterialInstanceAt(
                binding.renderable,
                binding.ref.primitive,
                binding.original,
            )
        }
        stencil.forget(instances.flatMap { bindings[it].orEmpty().map { row -> row.original } })
        instances.forEach {
            bindings.remove(it)
            applied.remove(it)
            groupIds.remove(it)
        }
    }

    override fun close() {
        stencil.close()
        groupIds.clear()
        bindings.clear()
        applied.clear()
        discard?.let(gpu::release)
        discard = null
    }
}
