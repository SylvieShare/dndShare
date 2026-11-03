package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import com.google.android.filament.gltfio.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

internal data class MapPrimitiveRef(val node: Int, val primitive: Int)

/** Exact primitive ownership: native water, nearest solid surfaces and ordinary alpha blending. */
internal class MapPrimitiveMaterials(private val engine: Engine, private val gpu: MapGpuMaterials) :
    AutoCloseable {
    private data class Binding(
        val entity: Int,
        val slot: Int,
        val ref: MapPrimitiveRef,
        val original: MaterialInstance,
    )

    private data class State(val water: Set<MapPrimitiveRef>, val group: Int, val selected: Boolean)

    private val stencil = MapStencilMaterials(engine, gpu)
    private val bindings = mutableMapOf<FilamentInstance, List<Binding>>()
    private val bound = mutableMapOf<FilamentInstance, MapRenderMaterials>()
    val renderMaterials
        get() =
            MapRenderMaterials(bound.values.flatMap { it.solid }, bound.values.flatMap { it.alpha })

    private val applied = mutableMapOf<FilamentInstance, State>()
    private var discard: MaterialInstance? = null

    fun apply(
        asset: FilamentAsset,
        instance: FilamentInstance,
        water: Set<MapPrimitiveRef>,
        group: Int,
        descriptors: Map<MapPrimitiveRef, JsonObject>,
        style: MapSurfaceStyle,
        selected: Boolean,
    ) {
        val manager = engine.renderableManager
        val rows =
            bindings.getOrPut(instance) {
                instance.entities.flatMap { entity ->
                    val named = mapNamedPart(asset.getName(entity))
                    val renderable = manager.getInstance(entity)
                    if (named == null || renderable == 0) emptyList()
                    else
                        (0 until manager.getPrimitiveCount(renderable)).map { slot ->
                            Binding(
                                entity,
                                slot,
                                MapPrimitiveRef(named.node, named.primitive ?: slot),
                                manager.getMaterialInstanceAt(renderable, slot),
                            )
                        }
                }
            }
        val state = State(water, group, selected)
        val rebind = applied[instance] != state
        val transparent = rows.any { descriptors[it.ref]?.string("alphaMode") == "BLEND" }
        if (!rebind && !transparent) return
        require(water.all { ref -> rows.any { it.ref == ref } }) {
            "Не удалось сопоставить поверхность воды с GLB"
        }
        applied[instance] = state
        val solid = mutableListOf<MaterialInstance>()
        val alpha = mutableListOf<MaterialInstance>()
        for (row in rows) {
            // Component slots compact after ANY renderable deletion, including another pool.
            val renderable = manager.getInstance(row.entity)
            if (renderable == 0) continue
            val data = descriptors[row.ref]
            val blend = data?.string("alphaMode") == "BLEND"
            val replacement =
                if (row.ref in water) discard ?: gpu.instance("discard").also { discard = it }
                else stencil.material(row.original, group)
            if (blend && group != 0 && row.ref !in water) {
                replacement.setStencilWrite(false)
                val factor =
                    (data.get("pbrMetallicRoughness") as? JsonObject)?.array("baseColorFactor")
                        ?: JsonArray(emptyList())
                replacement.setParameter(
                    "baseColorFactor",
                    (factor.double(0, 1.0) * style.brightness).toFloat(),
                    (factor.double(1, 1.0) * style.brightness).toFloat(),
                    (factor.double(2, 1.0) * style.brightness).toFloat(),
                    (factor.double(3, 1.0) * style.opacity).toFloat(),
                )
                if (
                    (data["extensions"] as? JsonObject)?.containsKey("KHR_materials_unlit") != true
                ) {
                    val colour = data.array("emissiveFactor") ?: JsonArray(emptyList())
                    val strength =
                        ((data.get("extensions") as? JsonObject)?.get(
                                "KHR_materials_emissive_strength"
                            ) as? JsonObject)
                            ?.number("emissiveStrength", 1.0) ?: 1.0
                    val bias = (style.brightness - 1) * .35
                    replacement.setParameter(
                        "emissiveFactor",
                        (colour.double(0) * strength * style.brightness + bias).toFloat(),
                        (colour.double(1) * strength * style.brightness + bias).toFloat(),
                        (colour.double(2) * strength * style.brightness + bias).toFloat(),
                    )
                }
            }
            if (blend) alpha += replacement else solid += replacement
            if (rebind) manager.setMaterialInstanceAt(renderable, row.slot, replacement)
            val layer =
                (if (style.opacity <= .001f) 0 else if (blend) 16 else if (group == 0) 1 else 2) or
                    (if (selected) 4 else 0)
            manager.setLayerMask(renderable, 255, layer)
        }
        bound[instance] = MapRenderMaterials(solid, alpha)
    }

    fun restore(instances: Collection<FilamentInstance>) {
        val manager = engine.renderableManager
        for (instance in instances) for (row in bindings[instance].orEmpty()) {
            val renderable = manager.getInstance(row.entity)
            if (renderable != 0) manager.setMaterialInstanceAt(renderable, row.slot, row.original)
        }
    }

    fun forget(instances: Collection<FilamentInstance>) {
        stencil.forget(instances.flatMap { bindings[it].orEmpty().map { row -> row.original } })
        instances.forEach {
            bound.remove(it)
            bindings.remove(it)
            applied.remove(it)
        }
    }

    override fun close() {
        bound.clear()
        stencil.close()
        bindings.clear()
        applied.clear()
        discard?.let(gpu::release)
        discard = null
    }
}
