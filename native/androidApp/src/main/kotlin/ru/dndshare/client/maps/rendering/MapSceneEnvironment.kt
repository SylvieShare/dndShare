package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import kotlin.math.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*

/** The sun and hemisphere survive local edits; only an environment change rebuilds them. */
internal class MapSceneEnvironment(private val engine: Engine, private val scene: Scene) :
    AutoCloseable {
    private val entities = mutableListOf<Int>()
    private var ambient: IndirectLight? = null
    private var signature = ""

    fun update(document: JsonObject) {
        val enabled = document.flag("lightingEnabled")
        val sun = document["sun"] as? JsonObject
        val key = listOf(enabled, sun).toString()
        if (key == signature) return
        signature = key
        release()
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
    }

    private fun add(builder: LightManager.Builder) {
        val entity = EntityManager.get().create()
        builder.build(engine, entity)
        scene.addEntity(entity)
        entities += entity
    }

    private fun release() {
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

    override fun close() = release()
}
