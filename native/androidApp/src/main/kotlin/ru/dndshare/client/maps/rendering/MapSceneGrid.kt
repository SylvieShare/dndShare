package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.MeshGeometry

/** Grid lines have a constant screen width; the empty map has no artificial opaque floor. */
internal class MapSceneGrid(
    private val engine: Engine,
    private val scene: Scene,
    private val gpu: MapGpuMaterials,
) : AutoCloseable {
    private var mesh: MapGpuMesh? = null
    private var entity: MapGpuEntity? = null
    private var key = ""

    fun update(document: JsonObject, enabled: Boolean) {
        val w = document.number("width").toFloat()
        val h = document.number("height").toFloat()
        val visible = enabled && ((document["grid"] as? JsonObject)?.flag("visible") != false)
        val next = "$w:$h:$visible"
        if (next == key) return
        key = next
        clear()
        if (!visible) return
        val vertices =
            MapGpuMesh(
                engine,
                MeshGeometry(
                    floatArrayOf(0f, -.003f, 0f, 0f, -.003f, h, w, -.003f, h, w, -.003f, 0f),
                    floatArrayOf(0f, 1f, 0f, 0f, 1f, 0f, 0f, 1f, 0f, 0f, 1f, 0f),
                    floatArrayOf(0f, 0f, 0f, 1f, 1f, 1f, 1f, 0f),
                    FloatArray(16) { 1f },
                    FloatArray(8),
                    intArrayOf(0, 1, 2, 0, 2, 3),
                ),
            )
        mesh = vertices
        val material =
            gpu.configure("grid") {
                it.setParameter("extent", w, h)
                val colour = mapLinearColour("#c8b695")
                it.setParameter("colour", colour[0], colour[1], colour[2])
            }
        entity = MapGpuEntity(engine, scene, vertices, material, priority = 0)
    }

    private fun clear() {
        entity?.close()
        entity = null
        mesh?.close()
        mesh = null
    }

    override fun close() = clear()
}
