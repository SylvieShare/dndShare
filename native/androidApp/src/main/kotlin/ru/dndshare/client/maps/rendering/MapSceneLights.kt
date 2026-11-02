package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import kotlin.math.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*

/** Units match the web: directional lux, local sources candela, explicit unit exposure. */
internal class MapSceneLights(private val engine: Engine, private val scene: Scene) :
    AutoCloseable {
    private data class Point(val entity: Int, val pose: MapLightPose, val ordinal: Int)

    private val entities = mutableListOf<Int>()
    private var points = emptyList<Point>()
    private var ambient: IndirectLight? = null
    private var signature = ""

    fun update(context: MapContext) {
        val document = context.document
        val enabled = document.flag("lightingEnabled")
        val posed =
            if (enabled)
                document
                    .rows("lights")
                    .map { mapLightPose(it, context) }
                    .filter { it.source.flag("enabled", true) && it.opacity > .001f }
            else emptyList()
        val key = listOf(enabled, document["sun"], posed).toString()
        if (key == signature) return
        signature = key
        clear()
        val sun = document["sun"] as? JsonObject
        val sunlight = sun?.flag("enabled", true) ?: true
        val strength = if (!enabled) 2f else if (sunlight) .6f else .28f
        val sky = mapLinearColour(if (enabled) "#cbd5ee" else "#ffffff")
        val ground = mapLinearColour(if (enabled) "#695641" else "#625141")
        val harmonics = FloatArray(27)
        for (i in 0..2) {
            harmonics[i] = ((sky[i] + ground[i]) * .5 / PI).toFloat()
            harmonics[3 + i] = ((sky[i] - ground[i]) * .5 / PI).toFloat()
        }
        ambient = IndirectLight.Builder().irradiance(3, harmonics).intensity(strength).build(engine)
        scene.indirectLight = ambient
        if (!enabled || sunlight) {
            val angle = Math.toRadians(sun?.number("angle", 225.0) ?: 225.0)
            val elevation = Math.toRadians(sun?.number("elevation", 45.0) ?: 45.0)
            val colour = mapLinearColour("#fff2df")
            add(
                LightManager.Builder(LightManager.Type.DIRECTIONAL)
                    .color(colour[0], colour[1], colour[2])
                    .intensity(if (enabled) 2.8f else 3f)
                    .direction(
                        if (enabled) (-sin(angle) * cos(elevation)).toFloat() else 20f,
                        if (enabled) -sin(elevation).toFloat() else -40f,
                        if (enabled) (-cos(angle) * cos(elevation)).toFloat() else 25f,
                    )
                    .castShadows(enabled)
            )
            val fill = mapLinearColour(if (enabled) "#bdcfff" else "#e0e8ff")
            add(
                LightManager.Builder(LightManager.Type.DIRECTIONAL)
                    .color(fill[0], fill[1], fill[2])
                    .intensity(if (enabled) .18f else .6f)
                    .direction(-20f, -12f, -25f)
                    .castShadows(false)
            )
        }
        points = posed.mapIndexed { i, pose ->
            val source = pose.source
            val colour = mapLinearColour(source.string("color", "#ffcf8a"))
            val entity =
                add(
                    LightManager.Builder(LightManager.Type.POINT)
                        .color(colour[0], colour[1], colour[2])
                        .position(
                            pose.point.x.toFloat(),
                            pose.worldHeight.toFloat(),
                            pose.point.y.toFloat(),
                        )
                        .intensityCandela(
                            (source.number("intensity", 1.0) * pose.opacity).toFloat()
                        )
                        .falloff(source.number("radius", 6.0).toFloat())
                        .castShadows(source.flag("shadows"))
                )
            Point(entity, pose, i)
        }
    }

    fun advance(seconds: Double, motion: Boolean): Boolean {
        var active = false
        val manager = engine.lightManager
        for (point in points) {
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
                else MapFireMotion(Vec3(0f, 0f, 0f), 1f)
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

    private fun add(builder: LightManager.Builder): Int {
        val entity = EntityManager.get().create()
        builder.build(engine, entity)
        scene.addEntity(entity)
        entities += entity
        return entity
    }

    private fun clear() {
        entities.forEach {
            scene.remove(it)
            engine.destroyEntity(it)
            EntityManager.get().destroy(it)
        }
        entities.clear()
        points = emptyList()
        scene.indirectLight = null
        ambient?.let(engine::destroyIndirectLight)
        ambient = null
    }

    override fun close() = clear()
}
