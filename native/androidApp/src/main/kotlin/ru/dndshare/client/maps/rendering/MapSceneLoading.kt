package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.MeshGeometry

/** One shared quad, shared appearance materials, renderer-thread lifetime and GPU picking. */
internal class MapSceneLoading(
    private val engine: Engine,
    private val scene: Scene,
    private val gpu: MapGpuMaterials,
) : AutoCloseable {
    private data class Style(val opacity: Int, val invalid: Boolean)

    private data class Instance(val style: Style, val entity: MapGpuEntity)

    private val mesh =
        MapGpuMesh(
            engine,
            MeshGeometry(
                floatArrayOf(-.5f, 0f, -.5f, .5f, 0f, -.5f, .5f, 0f, .5f, -.5f, 0f, .5f),
                floatArrayOf(0f, 1f, 0f, 0f, 1f, 0f, 0f, 1f, 0f, 0f, 1f, 0f),
                floatArrayOf(0f, 0f, 1f, 0f, 1f, 1f, 0f, 1f),
                FloatArray(16) { 1f },
                FloatArray(8),
                intArrayOf(0, 2, 1, 0, 3, 2),
            ),
        )
    private val materials = mutableMapOf<Style, MaterialInstance>()
    private val instances = mutableMapOf<MapEntityRef, Instance>()
    private var input: List<MapSceneEntry>? = null
    private var context: MapContext? = null
    private var ready = emptySet<MapEntityRef>()
    private var selected = emptySet<MapEntityRef>()
    private var invalid = emptySet<MapEntityRef>()
    val picks = mutableMapOf<Int, MapEntityRef>()
    val renderMaterials
        get() = MapRenderMaterials(alpha = materials.values.toList())

    fun update(
        value: MapContext,
        entries: List<MapSceneEntry>,
        readyRefs: Set<MapEntityRef>,
        selection: Set<MapEntityRef>,
        invalidRefs: Set<MapEntityRef>,
    ) {
        if (
            context === value &&
                input === entries &&
                ready == readyRefs &&
                selected == selection &&
                invalid == invalidRefs
        )
            return
        context = value
        input = entries
        ready = readyRefs
        selected = selection
        invalid = invalidRefs
        val wanted =
            entries
                .filter { it.ref !in readyRefs }
                .mapNotNull { mapLoadingFootprint(it, value) }
                .associateBy { it.ref }
        instances.keys.filter { it !in wanted }.forEach { instances.remove(it)?.entity?.close() }
        picks.clear()
        for ((ref, footprint) in wanted) {
            val style = Style((footprint.opacity * 255).toInt(), ref in invalidRefs)
            if (instances[ref]?.style != style) instances.remove(ref)?.entity?.close()
            val instance =
                instances.getOrPut(ref) {
                    val material =
                        materials.getOrPut(style) {
                            gpu.configure("loading") {
                                it.setParameter("time", 0f)
                                it.setParameter("opacity", .95f * style.opacity / 255)
                                it.setParameter("invalid", if (style.invalid) 1f else 0f)
                            }
                        }
                    Instance(
                        style,
                        MapGpuEntity(engine, scene, mesh, material, ownsMaterial = false),
                    )
                }
            instance.entity.transform(footprint.matrix)
            instance.entity.layer(16 or if (ref in selection) 4 else 0)
            picks[instance.entity.entity] = ref
        }
        val used = instances.values.map { it.style }.toSet()
        materials.keys
            .filter { it !in used }
            .forEach { materials.remove(it)?.let(engine::destroyMaterialInstance) }
    }

    fun advance(seconds: Double, animate: Boolean): Boolean {
        for (material in materials.values) material.setParameter(
            "time",
            if (animate) seconds.toFloat() else 0f,
        )
        return animate && instances.isNotEmpty()
    }

    override fun close() {
        instances.values.forEach { it.entity.close() }
        instances.clear()
        picks.clear()
        materials.values.forEach(engine::destroyMaterialInstance)
        materials.clear()
        mesh.close()
    }
}
