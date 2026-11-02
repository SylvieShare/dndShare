package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import kotlin.math.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

internal class MapSceneLights(private val engine: Engine, private val scene: Scene) :
    AutoCloseable {
    private val entities = mutableListOf<Int>()
    private var ambient: IndirectLight? = null
    private var signature = ""

    fun update(document: JsonObject, entries: List<MapSceneEntry>) {
        val enabled = document.flag("lightingEnabled")
        val key =
            if (enabled)
                "${document["lightingEnabled"]}:${document["sun"]}:${document["lights"]}:${entries.filter { entry -> document.rows("lights").any { (it["anchor"] as? JsonObject)?.string("id") == entry.id } }.map { it.id to it.matrix.toList() }}"
            else "off:${document["sun"]}"
        if (signature == key) return
        signature = key
        clear()
        ambient =
            IndirectLight.Builder()
                .irradiance(
                    3,
                    FloatArray(27).apply {
                        this[0] = 1f
                        this[1] = 1f
                        this[2] = 1f
                    },
                )
                .intensity(if (enabled) 12_000f else 30_000f)
                .build(engine)
        scene.indirectLight = ambient
        val sun = document["sun"] as? JsonObject
        if (!enabled || sun?.flag("enabled", true) == true) {
            val angle = Math.toRadians(sun?.number("angle", 225.0) ?: 225.0)
            val elevation = Math.toRadians(sun?.number("elevation", 45.0) ?: 45.0)
            add(
                LightManager.Builder(LightManager.Type.SUN)
                    .color(1f, .97f, .92f)
                    .intensity(if (enabled) 70_000f else 45_000f)
                    .direction(
                        (-sin(angle) * cos(elevation)).toFloat(),
                        -sin(elevation).toFloat(),
                        (-cos(angle) * cos(elevation)).toFloat(),
                    )
                    .castShadows(enabled)
            )
        }
        if (!enabled) return
        for (light in document.rows("lights").filter { it.flag("enabled", true) }) {
            val color =
                light.string("color", "#ffcf8a").removePrefix("#").toLongOrNull(16) ?: 0xffcf8a
            val r = ((color shr 16) and 255) / 255f
            val g = ((color shr 8) and 255) / 255f
            val b = (color and 255) / 255f
            add(
                LightManager.Builder(LightManager.Type.POINT)
                    .color(r, g, b)
                    .position(
                        light.number("x").toFloat(),
                        light.number("height", 2.0).toFloat(),
                        light.number("y").toFloat(),
                    )
                    .intensity((light.number("intensity", 1.0) * 2000).toFloat())
                    .falloff(light.number("radius", 6.0).toFloat())
                    .castShadows(light.flag("shadows"))
            )
        }
    }

    private fun add(builder: LightManager.Builder) {
        val entity = EntityManager.get().create()
        builder.build(engine, entity)
        scene.addEntity(entity)
        entities += entity
    }

    private fun clear() {
        entities.forEach {
            scene.remove(it)
            engine.destroyEntity(it)
            EntityManager.get().destroy(it)
        }
        entities.clear()
        scene.indirectLight = null
        ambient?.let(engine::destroyIndirectLight)
        ambient = null
    }

    override fun close() = clear()
}
