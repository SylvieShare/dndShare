package ru.dndshare.client.maps.rendering

import com.google.android.filament.*

/** Copies share PBR textures/parameters and batch by source material + surface group. */
internal class MapStencilMaterials(private val engine: Engine, private val gpu: MapGpuMaterials) :
    AutoCloseable {
    private val copies = mutableMapOf<Pair<Long, Int>, MaterialInstance>()

    fun material(original: MaterialInstance, group: Int): MaterialInstance {
        if (group == 0) return original
        return copies.getOrPut(original.nativeObject to group) {
            gpu.duplicate(original).apply {
                setStencilWrite(true)
                setStencilCompareFunction(TextureSampler.CompareFunc.A)
                setStencilReferenceValue(group)
                setStencilReadMask(255)
                setStencilWriteMask(255)
                setStencilOpDepthStencilPass(MaterialInstance.StencilOperation.REPLACE)
            }
        }
    }

    fun forget(originals: Collection<MaterialInstance>) {
        val ids = originals.map { it.nativeObject }.toSet()
        copies.keys.filter { it.first in ids }.forEach { copies.remove(it)?.let(gpu::release) }
    }

    override fun close() {
        copies.values.forEach(gpu::release)
        copies.clear()
    }
}
