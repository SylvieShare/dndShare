package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*

internal class MapSceneFire(
    private val engine: Engine,
    private val scene: Scene,
    private val gpu: MapGpuMaterials,
) : AutoCloseable {
    private var mesh: MapGpuMesh? = null
    private val flames = mutableMapOf<String, MapGpuEntity>()
    private var context: MapContext? = null
    private var sources = emptyList<MapLightPose>()
    val count
        get() = flames.size

    val picks
        get() = flames.map { (id, flame) -> flame.entity to (id to "light") }.toMap()

    fun update(value: MapContext) {
        context = value
        sources =
            value.document
                .rows("lights")
                .filter {
                    it.flag("enabled", true) &&
                        (it["effect"] as? JsonObject)?.string("kind") == "fire"
                }
                .map { mapFirePose(mapLightPose(it, value), value) }
                .filter { it.opacity > .001f }
        val ids = sources.map { it.source.string("id") }.toSet()
        flames.keys.filter { it !in ids }.forEach { flames.remove(it)?.close() }
        for (pose in sources) {
            val source = pose.source
            val id = source.string("id")
            val effect = source["effect"]!!.jsonObject
            val flame =
                flames.getOrPut(id) {
                    val geometry = mesh ?: MapGpuMesh(engine, mapFireGeometry()).also { mesh = it }
                    MapGpuEntity(engine, scene, geometry, gpu.instance("fire"), priority = 6)
                }
            val size = effect.array("size")
            val width = size.double(0, .22).toFloat()
            val height = size.double(1, .35).toFloat()
            val matrix = mapTransform(pose.point.x, pose.point.y, pose.worldHeight, 0.0)
            matrix[0] = width
            matrix[5] = height
            matrix[10] = width
            flame.transform(matrix)
            val colour = mapLinearColour(source.string("color", "#ffc36a"))
            flame.material.setParameter("colour", colour[0], colour[1], colour[2], pose.opacity)
            flame.material.setParameter("seed", (id.hashCode() % 1000).toFloat())
            flame.material.setParameter("strength", effect.number("strength", .7).toFloat())
        }
        advance(0.0, false)
    }

    fun advance(seconds: Double, motion: Boolean): Boolean {
        var active = false
        for (pose in sources) {
            val source = pose.source
            val effect = source["effect"]!!.jsonObject
            val moving = motion && effect.number("strength", .7) > 0
            flames[source.string("id")]
                ?.material
                ?.setParameter("clock", if (moving) mapEffectPhase(seconds).toFloat() else 0f)
            active = active || moving
        }
        return active
    }

    override fun close() {
        flames.values.forEach(MapGpuEntity::close)
        flames.clear()
        mesh?.close()
        mesh = null
    }
}
