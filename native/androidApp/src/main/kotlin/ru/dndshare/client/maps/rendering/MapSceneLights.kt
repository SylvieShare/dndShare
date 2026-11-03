package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import kotlin.math.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*

/** Eight persistent point lights match the web's visibility/selection/shadow/distance ordering. */
internal class MapSceneLights(private val engine: Engine, private val scene: Scene) :
    AutoCloseable {
    private data class Point(val entity: Int, var pose: MapLightPose, val ordinal: Int)

    private val environment = MapSceneEnvironment(engine, scene)
    private val points = mutableMapOf<String, Point>()
    private var sources = emptyList<MapLightPose>()
    private var ordinals = emptyMap<String, Int>()
    val count
        get() = points.size

    fun update(context: MapContext) {
        environment.update(context.document)
        sources =
            if (context.document.flag("lightingEnabled"))
                context.document.rows("lights").map { mapLightPose(it, context) }
            else emptyList()
        ordinals = sources.mapIndexed { i, pose -> pose.source.string("id") to i }.toMap()
    }

    private fun synchronize(
        camera: MapCamera,
        width: Int,
        height: Int,
        selected: String?,
        anchors: MapVisualAnchors,
    ) {
        val wanted = mapVisibleLights(sources.map(anchors::light), camera, width, height, selected)
        val ids = wanted.map { it.source.string("id") }.toSet()
        points.keys.filter { it !in ids }.forEach(::remove)
        val manager = engine.lightManager
        for (pose in wanted) {
            val source = pose.source
            val id = source.string("id")
            val point =
                points[id]
                    ?: run {
                        val entity = EntityManager.get().create()
                        val shadows = mapShadowOptions(512)
                        LightManager.Builder(LightManager.Type.POINT)
                            .intensityCandela(0f)
                            .shadowOptions(shadows)
                            .build(engine, entity)
                        scene.addEntity(entity)
                        Point(entity, pose, ordinals[id] ?: 0).also { points[id] = it }
                    }
            val instance = manager.getInstance(point.entity)
            if (point.pose.source != pose.source || manager.getIntensity(instance) == 0f) {
                val colour = mapLinearColour(source.string("color", "#ffcf8a"))
                manager.setColor(instance, colour[0], colour[1], colour[2])
                manager.setFalloff(instance, source.number("radius", 6.0).toFloat())
                manager.setShadowCaster(instance, source.flag("shadows"))
            }
            point.pose = pose
        }
    }

    fun advance(
        seconds: Double,
        motion: Boolean,
        camera: MapCamera,
        width: Int,
        height: Int,
        selected: String?,
        anchors: MapVisualAnchors,
    ): Boolean {
        synchronize(camera, width, height, selected, anchors)
        var active = false
        val manager = engine.lightManager
        for (point in points.values) {
            val source = point.pose.source
            val effect = source["effect"] as? JsonObject
            val size = effect?.array("size")
            val fire =
                if (motion && effect != null)
                    mapFireMotion(
                        source.string("id"),
                        seconds,
                        effect.number("strength", .7),
                        size?.double(0, .22) ?: .22,
                        size?.double(1, .35) ?: .35,
                    )
                else MapFireMotion(Vec3.ZERO, 1f)
            val flicker =
                if (effect != null) fire.gain
                else if (motion && source.flag("flicker"))
                    (1 +
                            .035 * sin(seconds * 8.2 + point.ordinal * 2) +
                            .025 * sin(seconds * 13.7 + point.ordinal))
                        .toFloat()
                else 1f
            val instance = manager.getInstance(point.entity)
            manager.setPosition(
                instance,
                point.pose.point.x.toFloat() + fire.offset.x,
                point.pose.worldHeight.toFloat() + fire.offset.y,
                point.pose.point.y.toFloat() + fire.offset.z,
            )
            manager.setIntensity(
                instance,
                (source.number("intensity", 1.0) * point.pose.opacity * 4 * PI * flicker).toFloat(),
            )
            active =
                active ||
                    motion &&
                        (effect?.number("strength", .7)?.let { it > 0 } ?: source.flag("flicker"))
        }
        return active
    }

    private fun remove(id: String) {
        points.remove(id)?.let {
            scene.remove(it.entity)
            engine.destroyEntity(it.entity)
            EntityManager.get().destroy(it.entity)
        }
    }

    override fun close() {
        points.keys.toList().forEach(::remove)
        environment.close()
    }
}
