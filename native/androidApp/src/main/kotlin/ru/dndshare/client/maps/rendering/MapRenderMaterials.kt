package ru.dndshare.client.maps.rendering

import com.google.android.filament.MaterialInstance

/** Auxiliary views keep solid shadow casters without drawing their colour/depth twice. */
internal data class MapRenderMaterials(
    val solid: List<MaterialInstance> = emptyList(),
    val alpha: List<MaterialInstance> = emptyList(),
) {
    operator fun plus(other: MapRenderMaterials) =
        MapRenderMaterials(solid + other.solid, alpha + other.alpha)

    fun alphaOnly(draw: () -> Unit) {
        val states =
            solid
                .distinctBy { it.nativeObject }
                .map { Triple(it, it.isColorWriteEnabled, it.isDepthWriteEnabled) }
        try {
            for ((material, _, _) in states) {
                material.setColorWrite(false)
                material.setDepthWrite(false)
            }
            draw()
        } finally {
            for ((material, colour, depth) in states) {
                material.setColorWrite(colour)
                material.setDepthWrite(depth)
            }
        }
    }

    fun selectionDepth(draw: () -> Unit) {
        val disabled = alpha.distinctBy { it.nativeObject }.filter { !it.isDepthWriteEnabled }
        try {
            disabled.forEach { it.setDepthWrite(true) }
            draw()
        } finally {
            disabled.forEach { it.setDepthWrite(false) }
        }
    }
}
